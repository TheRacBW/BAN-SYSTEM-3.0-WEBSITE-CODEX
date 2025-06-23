import { supabase } from '../lib/supabase';
import { LeaderboardEntry, LeaderboardStats, calculateRankFromRP } from '../types/leaderboard';
import { robloxApi } from './robloxApi';

class LeaderboardService {
  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_rp', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching leaderboard:', error);
        throw error;
      }

      // Enrich entries with Roblox data (profile pictures, user IDs)
      const enrichedData = await Promise.all(
        data.map(async (entry) => {
          try {
            return await robloxApi.enrichLeaderboardEntry(entry);
          } catch (error) {
            console.warn(`Failed to enrich entry for ${entry.username}:`, error);
            return entry;
          }
        })
      );

      // Sort by calculated rank tier and total RP
      const sortedData = enrichedData.sort((a: LeaderboardEntry, b: LeaderboardEntry) => {
        // First sort by total RP (descending)
        const rpDiff = (b.total_rp || b.rp || 0) - (a.total_rp || a.rp || 0);
        if (rpDiff !== 0) return rpDiff;
        
        // If RP is the same, sort by username
        return a.username.localeCompare(b.username);
      });

      // Update rank positions based on sorted order
      return sortedData.map((entry: LeaderboardEntry, index: number) => ({
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
      const { data, error } = await supabase
        .from('rp_changes')
        .select('username, rp_change, new_calculated_rank, total_rp')
        .gte('change_timestamp', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
        .gt('rp_change', 0)
        .order('rp_change', { ascending: false })
        .limit(20); // Get more data to account for grouping

      if (error) {
        console.error('Error fetching hottest gainers:', error);
        throw error;
      }

      // Group by username and sum the gains
      const gainsMap = new Map<string, { total_gain: number; calculated_rank_tier?: string; total_rp?: number }>();
      data.forEach(change => {
        const current = gainsMap.get(change.username) || { total_gain: 0 };
        gainsMap.set(change.username, {
          total_gain: current.total_gain + change.rp_change,
          calculated_rank_tier: change.new_calculated_rank,
          total_rp: change.total_rp
        });
      });

      const gainers: LeaderboardStats[] = Array.from(gainsMap.entries())
        .map(([username, data]) => ({ 
          username, 
          total_gain: data.total_gain,
          calculated_rank_tier: data.calculated_rank_tier as any,
          total_rp: data.total_rp
        }))
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
      const { data, error } = await supabase
        .from('rp_changes')
        .select('username, rp_change, new_calculated_rank, total_rp')
        .gte('change_timestamp', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
        .lt('rp_change', 0)
        .order('rp_change', { ascending: true })
        .limit(20); // Get more data to account for grouping

      if (error) {
        console.error('Error fetching biggest losers:', error);
        throw error;
      }

      // Group by username and sum the losses
      const lossesMap = new Map<string, { total_loss: number; calculated_rank_tier?: string; total_rp?: number }>();
      data.forEach(change => {
        const current = lossesMap.get(change.username) || { total_loss: 0 };
        lossesMap.set(change.username, {
          total_loss: current.total_loss + change.rp_change,
          calculated_rank_tier: change.new_calculated_rank,
          total_rp: change.total_rp
        });
      });

      const losers: LeaderboardStats[] = Array.from(lossesMap.entries())
        .map(([username, data]) => ({ 
          username, 
          total_loss: data.total_loss,
          calculated_rank_tier: data.calculated_rank_tier as any,
          total_rp: data.total_rp
        }))
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
      const { data, error } = await supabase
        .from('rank_statistics')
        .select('*')
        .order('calculated_rank_tier, calculated_rank_number');

      if (error) {
        console.error('Error fetching rank statistics:', error);
        return [];
      }

      return data || [];
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

  // Helper method to calculate rank changes
  calculateRankChanges(previousEntry: LeaderboardEntry, currentEntry: LeaderboardEntry) {
    const previousRank = calculateRankFromRP(previousEntry.total_rp || previousEntry.rp || 0);
    const currentRank = calculateRankFromRP(currentEntry.total_rp || currentEntry.rp || 0);
    
    const previousRankIndex = this.getRankTierIndex(previousRank.rank_tier, previousRank.rank_number);
    const currentRankIndex = this.getRankTierIndex(currentRank.rank_tier, currentRank.rank_number);
    
    return {
      rankTierChange: currentRankIndex - previousRankIndex,
      previousRank,
      currentRank,
      rpChange: (currentEntry.total_rp || currentEntry.rp || 0) - (previousEntry.total_rp || previousEntry.rp || 0)
    };
  }

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