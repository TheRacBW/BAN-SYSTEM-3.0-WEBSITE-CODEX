import { supabase } from '../lib/supabase';
import { LeaderboardEntry, LeaderboardStats, RawLeaderboardEntry } from '../types/leaderboard';
import { robloxApi } from './robloxApi';
import { calculateRankFromRPCached, CalculatedRank, isValidRP } from '../utils/rankingSystem';

class LeaderboardService {
  /**
   * Process raw leaderboard data and calculate ranks on frontend
   */
  private processRawData(rawData: RawLeaderboardEntry[]): LeaderboardEntry[] {
    return rawData.map(entry => {
      // Calculate rank from raw RP
      const calculatedRank = isValidRP(entry.rp) ? calculateRankFromRPCached(entry.rp) : null;
      
      return {
        ...entry,
        // Legacy fields for backward compatibility
        calculated_rank_tier: calculatedRank?.tier,
        calculated_rank_number: calculatedRank?.level,
        display_rp: calculatedRank?.displayRP,
        total_rp: calculatedRank?.totalRP,
        // New frontend-calculated field
        calculatedRank
      };
    });
  }

  /**
   * Sort entries by calculated rank tier and total RP
   */
  private sortEntriesByRank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
    return entries.sort((a, b) => {
      // Use calculated rank if available, otherwise fall back to raw RP
      const aRank = a.calculatedRank || (a.total_rp !== undefined ? calculateRankFromRPCached(a.total_rp) : null);
      const bRank = b.calculatedRank || (b.total_rp !== undefined ? calculateRankFromRPCached(b.total_rp) : null);
      
      if (aRank && bRank) {
        // Sort by tier index (higher = better)
        const tierDiff = bRank.tierIndex - aRank.tierIndex;
        if (tierDiff !== 0) return tierDiff;
        
        // If same tier, sort by total RP
        return bRank.totalRP - aRank.totalRP;
      }
      
      // Fallback to raw RP sorting
      const rpDiff = (b.rp || 0) - (a.rp || 0);
      if (rpDiff !== 0) return rpDiff;
      
      // If RP is the same, sort by username
      return a.username.localeCompare(b.username);
    });
  }

  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      // Fetch raw data from database (no calculated fields needed)
      const { data, error } = await supabase
        .from('leaderboard')
        .select('id, username, rank_position, rp, rank_title, inserted_at, profile_picture, user_id')
        .order('rp', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
      }

      // Process raw data and calculate ranks on frontend
      const processedData = this.processRawData(data || []);

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

      // Sort by calculated rank tier and total RP
      const sortedData = this.sortEntriesByRank(enrichedData);

      // Update rank positions based on sorted order
      return sortedData.map((entry, index) => ({
        ...entry,
        rank_position: index + 1
      }));
    } catch (error) {
      console.error('Error in getCurrentLeaderboard:', error);
      throw error;
    }
  }

  async getHottestGainers(): Promise<LeaderboardStats[]> {
    try {
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

      // Group by username and sum the gains
      const gainsMap = new Map<string, { total_gain: number; total_rp: number }>();
      data.forEach(change => {
        const current = gainsMap.get(change.username) || { total_gain: 0, total_rp: 0 };
        gainsMap.set(change.username, {
          total_gain: current.total_gain + change.rp_change,
          total_rp: change.new_rp // Use the latest RP value
        });
      });

      const gainers: LeaderboardStats[] = Array.from(gainsMap.entries())
        .map(([username, data]) => {
          const calculatedRank = isValidRP(data.total_rp) ? calculateRankFromRPCached(data.total_rp) : null;
          
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

      return enrichedGainers;
    } catch (error) {
      console.error('Error in getHottestGainers:', error);
      throw error;
    }
  }

  async getBiggestLosers(): Promise<LeaderboardStats[]> {
    try {
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

      // Group by username and sum the losses
      const lossesMap = new Map<string, { total_loss: number; total_rp: number }>();
      data.forEach(change => {
        const current = lossesMap.get(change.username) || { total_loss: 0, total_rp: 0 };
        lossesMap.set(change.username, {
          total_loss: current.total_loss + change.rp_change,
          total_rp: change.new_rp // Use the latest RP value
        });
      });

      const losers: LeaderboardStats[] = Array.from(lossesMap.entries())
        .map(([username, data]) => {
          const calculatedRank = isValidRP(data.total_rp) ? calculateRankFromRPCached(data.total_rp) : null;
          
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

      return enrichedLosers;
    } catch (error) {
      console.error('Error in getBiggestLosers:', error);
      throw error;
    }
  }

  async getLastUpdateTime(): Promise<string> {
    try {
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

      return data?.inserted_at || new Date().toISOString();
    } catch (error) {
      console.error('Error in getLastUpdateTime:', error);
      return new Date().toISOString();
    }
  }

  async getRankStatistics(): Promise<any[]> {
    try {
      // Get raw data and calculate statistics on frontend
      const { data, error } = await supabase
        .from('leaderboard')
        .select('rp')
        .order('rp', { ascending: false });

      if (error) {
        console.error('Error fetching rank statistics:', error);
        return [];
      }

      // Calculate statistics on frontend
      const calculatedRanks = (data || [])
        .filter(entry => isValidRP(entry.rp))
        .map(entry => calculateRankFromRPCached(entry.rp));

      // Group by tier and level
      const statsMap = new Map<string, { count: number; totalRP: number; minRP: number; maxRP: number }>();
      
      calculatedRanks.forEach(rank => {
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
      return stats.sort((a, b) => {
        const aIndex = calculateRankFromRPCached(a.min_rp).tierIndex;
        const bIndex = calculateRankFromRPCached(b.min_rp).tierIndex;
        return aIndex - bIndex;
      });
    } catch (error) {
      console.error('Error in getRankStatistics:', error);
      return [];
    }
  }

  isLive(lastUpdate: string): boolean {
    const lastUpdateTime = new Date(lastUpdate).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return now - lastUpdateTime < fiveMinutes;
  }

  // Helper method to calculate rank changes between two entries
  calculateRankChanges(previousEntry: LeaderboardEntry, currentEntry: LeaderboardEntry) {
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
  }

  // Helper method to get rank tier index for sorting
  private getRankTierIndex(rankTier: string, rankNumber: number): number {
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
  }
}

export const leaderboardService = new LeaderboardService(); 