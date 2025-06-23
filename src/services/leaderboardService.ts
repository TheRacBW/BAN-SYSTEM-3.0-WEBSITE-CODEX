import { supabase } from '../lib/supabase';
import { LeaderboardEntry, LeaderboardStats } from '../types/leaderboard';
import { robloxApi } from './robloxApi';

class LeaderboardService {
  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rank_position')
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

      return enrichedData;
    } catch (error) {
      console.error('Error in getCurrentLeaderboard:', error);
      throw error;
    }
  }

  async getHottestGainers(): Promise<LeaderboardStats[]> {
    try {
      const { data, error } = await supabase
        .from('rp_changes')
        .select('username, rp_change')
        .gte('change_timestamp', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
        .gt('rp_change', 0)
        .order('rp_change', { ascending: false })
        .limit(4);

      if (error) {
        console.error('Error fetching hottest gainers:', error);
        throw error;
      }

      // Group by username and sum the gains
      const gainsMap = new Map<string, number>();
      data.forEach(change => {
        const current = gainsMap.get(change.username) || 0;
        gainsMap.set(change.username, current + change.rp_change);
      });

      const gainers: LeaderboardStats[] = Array.from(gainsMap.entries())
        .map(([username, total_gain]) => ({ username, total_gain }))
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
        .select('username, rp_change')
        .gte('change_timestamp', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
        .lt('rp_change', 0)
        .order('rp_change', { ascending: true })
        .limit(4);

      if (error) {
        console.error('Error fetching biggest losers:', error);
        throw error;
      }

      // Group by username and sum the losses
      const lossesMap = new Map<string, number>();
      data.forEach(change => {
        const current = lossesMap.get(change.username) || 0;
        lossesMap.set(change.username, current + change.rp_change);
      });

      const losers: LeaderboardStats[] = Array.from(lossesMap.entries())
        .map(([username, total_loss]) => ({ username, total_loss }))
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

  isLive(lastUpdate: string): boolean {
    const lastUpdateTime = new Date(lastUpdate).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return now - lastUpdateTime < fiveMinutes;
  }
}

export const leaderboardService = new LeaderboardService(); 