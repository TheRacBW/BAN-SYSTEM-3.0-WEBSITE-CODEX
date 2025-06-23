import { supabase } from '../lib/supabase';
import { LeaderboardEntry, LeaderboardStats, RawLeaderboardEntry } from '../types/leaderboard';
import { robloxApi } from './robloxApi';
import { calculateRankFromRPCached, CalculatedRank, isValidRP } from '../utils/rankingSystem';

class LeaderboardService {
  /**
   * Process raw leaderboard data and calculate ranks on frontend
   */
  private processRawData(rawData: RawLeaderboardEntry[]): LeaderboardEntry[] {
    console.log('Processing raw data:', rawData?.length || 0, 'entries');
    
    if (!rawData || !Array.isArray(rawData)) {
      console.warn('Invalid raw data received:', rawData);
      return [];
    }

    return rawData.map((entry, index) => {
      try {
        // Validate entry data
        if (!entry || typeof entry !== 'object') {
          console.warn(`Invalid entry at index ${index}:`, entry);
          return null;
        }

        // Ensure required fields exist
        const username = entry.username || 'Unknown';
        const rp = typeof entry.rp === 'number' ? entry.rp : 0;
        const rank_position = typeof entry.rank_position === 'number' ? entry.rank_position : index + 1;
        const rank_title = entry.rank_title || 'Unknown';
        const inserted_at = entry.inserted_at || new Date().toISOString();

        // Calculate rank from raw RP with error handling
        let calculatedRank: CalculatedRank | null = null;
        try {
          calculatedRank = isValidRP(rp) ? calculateRankFromRPCached(rp) : null;
        } catch (error) {
          console.warn(`Failed to calculate rank for ${username} with RP ${rp}:`, error);
          // Fallback to Bronze 1
          calculatedRank = {
            tier: 'Bronze',
            level: 1,
            displayRP: Math.min(rp, 99),
            totalRP: rp,
            calculatedRank: 'Bronze 1',
            tierIndex: 1001
          };
        }
        
        return {
          id: entry.id,
          username,
          rank_position,
          rp,
          rank_title,
          inserted_at,
          profile_picture: entry.profile_picture,
          user_id: entry.user_id,
          // Legacy fields for backward compatibility
          calculated_rank_tier: calculatedRank?.tier,
          calculated_rank_number: calculatedRank?.level,
          display_rp: calculatedRank?.displayRP,
          total_rp: calculatedRank?.totalRP,
          // New frontend-calculated field
          calculatedRank
        };
      } catch (error) {
        console.error(`Error processing entry at index ${index}:`, error, entry);
        return null;
      }
    }).filter(Boolean) as LeaderboardEntry[];
  }

  /**
   * Sort entries by calculated rank tier and total RP
   */
  private sortEntriesByRank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    if (!entries || !Array.isArray(entries)) {
      console.warn('Invalid entries for sorting:', entries);
      return [];
    }

    return entries.sort((a, b) => {
      try {
        // Use calculated rank if available, otherwise fall back to raw RP
        let aRank: CalculatedRank | null = null;
        let bRank: CalculatedRank | null = null;

        try {
          aRank = a.calculatedRank || (a.total_rp !== undefined ? calculateRankFromRPCached(a.total_rp) : null);
        } catch (error) {
          console.warn(`Failed to get rank for ${a.username}:`, error);
        }

        try {
          bRank = b.calculatedRank || (b.total_rp !== undefined ? calculateRankFromRPCached(b.total_rp) : null);
        } catch (error) {
          console.warn(`Failed to get rank for ${b.username}:`, error);
        }
        
        if (aRank && bRank) {
          // Sort by tier index (higher = better)
          const tierDiff = bRank.tierIndex - aRank.tierIndex;
          if (tierDiff !== 0) return tierDiff;
          
          // If same tier, sort by total RP
          return bRank.totalRP - aRank.totalRP;
        }
        
        // Fallback to raw RP sorting
        const aRp = typeof a.rp === 'number' ? a.rp : 0;
        const bRp = typeof b.rp === 'number' ? b.rp : 0;
        const rpDiff = bRp - aRp;
        if (rpDiff !== 0) return rpDiff;
        
        // If RP is the same, sort by username
        return (a.username || '').localeCompare(b.username || '');
      } catch (error) {
        console.error('Error in sortEntriesByRank:', error);
        return 0;
      }
    });
  }

  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      console.log('Fetching current leaderboard...');
      
      // Fetch raw data from database (no calculated fields needed)
      const { data, error } = await supabase
        .from('leaderboard')
        .select('id, username, rank_position, rp, rank_title, inserted_at, profile_picture, user_id')
        .order('rp', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Supabase error fetching leaderboard:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('Raw data from Supabase:', data?.length || 0, 'entries');
      console.log('Sample entry:', data?.[0]);

      // Process raw data and calculate ranks on frontend
      const processedData = this.processRawData(data || []);
      console.log('Processed data:', processedData.length, 'entries');

      // Enrich entries with Roblox data (profile pictures, user IDs)
      const enrichedData = await Promise.all(
        processedData.map(async (entry) => {
          try {
            return await robloxApi.enrichLeaderboardEntry(entry);
          } catch (error) {
            console.warn(`Failed to enrich entry for ${entry.username}:`, error);
            return entry;
          }
        })
      );

      console.log('Enriched data:', enrichedData.length, 'entries');

      // Sort by calculated rank tier and total RP
      const sortedData = this.sortEntriesByRank(enrichedData);
      console.log('Sorted data:', sortedData.length, 'entries');

      // Update rank positions based on sorted order
      const finalData = sortedData.map((entry, index) => ({
        ...entry,
        rank_position: index + 1
      }));

      console.log('Final leaderboard data:', finalData.length, 'entries');
      return finalData;
    } catch (error) {
      console.error('Error in getCurrentLeaderboard:', error);
      throw error;
    }
  }

  async getHottestGainers(): Promise<LeaderboardStats[]> {
    try {
      console.log('Fetching hottest gainers...');
      
      // Fetch raw RP changes data
      const { data, error } = await supabase
        .from('rp_changes')
        .select('username, rp_change, new_rp, change_timestamp')
        .gte('change_timestamp', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
        .gt('rp_change', 0)
        .order('rp_change', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching hottest gainers:', error);
        throw error;
      }

      console.log('RP changes data:', data?.length || 0, 'entries');

      // Group by username and sum the gains
      const gainsMap = new Map<string, { total_gain: number; total_rp: number }>();
      (data || []).forEach(change => {
        if (!change || !change.username) {
          console.warn('Invalid change entry:', change);
          return;
        }

        const current = gainsMap.get(change.username) || { total_gain: 0, total_rp: 0 };
        gainsMap.set(change.username, {
          total_gain: current.total_gain + (change.rp_change || 0),
          total_rp: change.new_rp || 0 // Use the latest RP value
        });
      });

      const gainers: LeaderboardStats[] = Array.from(gainsMap.entries())
        .map(([username, data]) => {
          let calculatedRank: CalculatedRank | null = null;
          try {
            calculatedRank = isValidRP(data.total_rp) ? calculateRankFromRPCached(data.total_rp) : null;
          } catch (error) {
            console.warn(`Failed to calculate rank for gainer ${username}:`, error);
          }
          
          return {
            username,
            total_gain: data.total_gain,
            total_rp: data.total_rp,
            // Legacy fields for backward compatibility
            calculated_rank_tier: calculatedRank?.tier,
            calculated_rank_number: calculatedRank?.level,
            display_rp: calculatedRank?.displayRP,
            // New frontend-calculated field
            calculatedRank
          };
        })
        .sort((a, b) => (b.total_gain || 0) - (a.total_gain || 0))
        .slice(0, 4);

      console.log('Gainers before enrichment:', gainers.length);

      // Enrich with profile pictures
      const enrichedGainers = await Promise.all(
        gainers.map(async (gainer) => {
          try {
            const user = await robloxApi.searchUser(gainer.username);
            if (user) {
              const profilePicture = await robloxApi.getProfilePicture(user.id);
              return {
                ...gainer,
                user_id: user.id,
                profile_picture: profilePicture
              };
            }
            return gainer;
          } catch (error) {
            console.warn(`Failed to enrich gainer ${gainer.username}:`, error);
            return gainer;
          }
        })
      );

      console.log('Final gainers:', enrichedGainers.length);
      return enrichedGainers;
    } catch (error) {
      console.error('Error in getHottestGainers:', error);
      throw error;
    }
  }

  async getBiggestLosers(): Promise<LeaderboardStats[]> {
    try {
      console.log('Fetching biggest losers...');
      
      // Fetch raw RP changes data
      const { data, error } = await supabase
        .from('rp_changes')
        .select('username, rp_change, new_rp, change_timestamp')
        .gte('change_timestamp', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
        .lt('rp_change', 0)
        .order('rp_change', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error fetching biggest losers:', error);
        throw error;
      }

      console.log('RP changes data for losers:', data?.length || 0, 'entries');

      // Group by username and sum the losses
      const lossesMap = new Map<string, { total_loss: number; total_rp: number }>();
      (data || []).forEach(change => {
        if (!change || !change.username) {
          console.warn('Invalid change entry:', change);
          return;
        }

        const current = lossesMap.get(change.username) || { total_loss: 0, total_rp: 0 };
        lossesMap.set(change.username, {
          total_loss: current.total_loss + (change.rp_change || 0),
          total_rp: change.new_rp || 0 // Use the latest RP value
        });
      });

      const losers: LeaderboardStats[] = Array.from(lossesMap.entries())
        .map(([username, data]) => {
          let calculatedRank: CalculatedRank | null = null;
          try {
            calculatedRank = isValidRP(data.total_rp) ? calculateRankFromRPCached(data.total_rp) : null;
          } catch (error) {
            console.warn(`Failed to calculate rank for loser ${username}:`, error);
          }
          
          return {
            username,
            total_loss: data.total_loss,
            total_rp: data.total_rp,
            // Legacy fields for backward compatibility
            calculated_rank_tier: calculatedRank?.tier,
            calculated_rank_number: calculatedRank?.level,
            display_rp: calculatedRank?.displayRP,
            // New frontend-calculated field
            calculatedRank
          };
        })
        .sort((a, b) => (a.total_loss || 0) - (b.total_loss || 0))
        .slice(0, 4);

      console.log('Losers before enrichment:', losers.length);

      // Enrich with profile pictures
      const enrichedLosers = await Promise.all(
        losers.map(async (loser) => {
          try {
            const user = await robloxApi.searchUser(loser.username);
            if (user) {
              const profilePicture = await robloxApi.getProfilePicture(user.id);
              return {
                ...loser,
                user_id: user.id,
                profile_picture: profilePicture
              };
            }
            return loser;
          } catch (error) {
            console.warn(`Failed to enrich loser ${loser.username}:`, error);
            return loser;
          }
        })
      );

      console.log('Final losers:', enrichedLosers.length);
      return enrichedLosers;
    } catch (error) {
      console.error('Error in getBiggestLosers:', error);
      throw error;
    }
  }

  async getLastUpdateTime(): Promise<string> {
    try {
      console.log('Fetching last update time...');
      
      const { data, error } = await supabase
        .from('leaderboard')
        .select('inserted_at')
        .order('inserted_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching last update time:', error);
        return new Date().toISOString();
      }

      const lastUpdate = data?.inserted_at || new Date().toISOString();
      console.log('Last update time:', lastUpdate);
      return lastUpdate;
    } catch (error) {
      console.error('Error in getLastUpdateTime:', error);
      return new Date().toISOString();
    }
  }

  async getRankStatistics(): Promise<any[]> {
    try {
      console.log('Fetching rank statistics...');
      
      // Get raw data and calculate statistics on frontend
      const { data, error } = await supabase
        .from('leaderboard')
        .select('rp')
        .order('rp', { ascending: false });

      if (error) {
        console.error('Error fetching rank statistics:', error);
        return [];
      }

      console.log('Raw data for statistics:', data?.length || 0, 'entries');

      // Calculate statistics on frontend
      const calculatedRanks = (data || [])
        .filter(entry => {
          try {
            return isValidRP(entry.rp);
          } catch (error) {
            console.warn('Invalid RP for statistics:', entry.rp, error);
            return false;
          }
        })
        .map(entry => {
          try {
            return calculateRankFromRPCached(entry.rp);
          } catch (error) {
            console.warn('Failed to calculate rank for statistics:', entry.rp, error);
            return null;
          }
        })
        .filter(Boolean);

      console.log('Calculated ranks for statistics:', calculatedRanks.length);

      // Group by tier and level
      const statsMap = new Map<string, { count: number; totalRP: number; minRP: number; maxRP: number }>();
      
      calculatedRanks.forEach(rank => {
        if (!rank) return;
        
        const key = `${rank.tier}_${rank.level}`;
        const current = statsMap.get(key) || { count: 0, totalRP: 0, minRP: rank.totalRP, maxRP: rank.totalRP };
        
        statsMap.set(key, {
          count: current.count + 1,
          totalRP: current.totalRP + rank.totalRP,
          minRP: Math.min(current.minRP, rank.totalRP),
          maxRP: Math.max(current.maxRP, rank.totalRP)
        });
      });

      // Convert to array format
      const stats = Array.from(statsMap.entries()).map(([key, data]) => {
        const [tier, level] = key.split('_');
        return {
          calculated_rank_tier: tier,
          calculated_rank_number: parseInt(level),
          player_count: data.count,
          avg_rp: Math.round(data.totalRP / data.count),
          min_rp: data.minRP,
          max_rp: data.maxRP
        };
      });

      // Sort by tier index
      const sortedStats = stats.sort((a, b) => {
        try {
          const aIndex = calculateRankFromRPCached(a.min_rp).tierIndex;
          const bIndex = calculateRankFromRPCached(b.min_rp).tierIndex;
          return aIndex - bIndex;
        } catch (error) {
          console.warn('Error sorting statistics:', error);
          return 0;
        }
      });

      console.log('Final statistics:', sortedStats.length, 'entries');
      return sortedStats;
    } catch (error) {
      console.error('Error in getRankStatistics:', error);
      return [];
    }
  }

  isLive(lastUpdate: string): boolean {
    try {
      const lastUpdateTime = new Date(lastUpdate).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      return now - lastUpdateTime < fiveMinutes;
    } catch (error) {
      console.warn('Error checking if data is live:', error);
      return false;
    }
  }

  // Helper method to calculate rank changes between two entries
  calculateRankChanges(previousEntry: LeaderboardEntry, currentEntry: LeaderboardEntry) {
    try {
      const previousRank = previousEntry.calculatedRank || 
        (previousEntry.total_rp !== undefined ? calculateRankFromRPCached(previousEntry.total_rp) : null);
      const currentRank = currentEntry.calculatedRank || 
        (currentEntry.total_rp !== undefined ? calculateRankFromRPCached(currentEntry.total_rp) : null);
      
      if (!previousRank || !currentRank) {
        return {
          rankTierChange: 0,
          previousRank: null,
          currentRank: null,
          rpChange: (currentEntry.rp || 0) - (previousEntry.rp || 0)
        };
      }
      
      return {
        rankTierChange: currentRank.tierIndex - previousRank.tierIndex,
        previousRank,
        currentRank,
        rpChange: currentRank.totalRP - previousRank.totalRP
      };
    } catch (error) {
      console.error('Error calculating rank changes:', error);
      return {
        rankTierChange: 0,
        previousRank: null,
        currentRank: null,
        rpChange: 0
      };
    }
  }

  // Helper method to get rank tier index for sorting
  private getRankTierIndex(rankTier: string, rankNumber: number): number {
    try {
      const tierIndex = {
        'Bronze': 1,
        'Silver': 2,
        'Gold': 3,
        'Platinum': 4,
        'Diamond': 5,
        'Emerald': 6,
        'Nightmare': 7
      };
      
      const baseIndex = (tierIndex[rankTier as keyof typeof tierIndex] || 0) * 1000;
      return baseIndex + rankNumber;
    } catch (error) {
      console.error('Error getting rank tier index:', error);
      return 0;
    }
  }
}

export const leaderboardService = new LeaderboardService(); 