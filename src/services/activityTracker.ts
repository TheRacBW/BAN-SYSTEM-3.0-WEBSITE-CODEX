import { supabase } from '../lib/supabase';

interface UserStatus {
  userId: string;
  username?: string;
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  placeId?: number;
  universeId?: number;
  lastUpdated?: number;
}

interface ActivityData {
  user_id: string;
  daily_minutes_today: number;
  weekly_average: number;
  activity_trend: string;
  preferred_time_period: string;
  current_session_minutes: number;
  is_online: boolean;
  last_updated: string;
}

// Frontend service to track activity in database
export class FrontendActivityTracker {
  private static lastTrackingTime = new Map<string, number>();
  private static readonly RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes
  
  // Track status change from frontend with rate limiting
  static async trackStatusChange(userId: string, currentStatus: UserStatus, previousStatus?: UserStatus) {
    try {
      // Rate limiting - don't track same user too frequently
      const lastTracked = this.lastTrackingTime.get(userId) || 0;
      const now = Date.now();
      
      if (now - lastTracked < this.RATE_LIMIT_MS) {
        console.log(`Rate limiting: ${userId} tracked ${Math.round((now - lastTracked) / 1000)}s ago`);
        return null; // Skip tracking
      }
      
      // Check if status actually changed
      const wasOnline = previousStatus?.isOnline || previousStatus?.isInGame || previousStatus?.inBedwars;
      const isOnline = currentStatus.isOnline || currentStatus.isInGame || currentStatus.inBedwars;
      
      const statusChanged = (
        wasOnline !== isOnline ||
        previousStatus?.isInGame !== currentStatus.isInGame ||
        previousStatus?.inBedwars !== currentStatus.inBedwars
      );
      
      // Only track if status changed OR it's been >10 minutes (heartbeat)
      const timeSinceLastCheck = now - lastTracked;
      const needsHeartbeat = timeSinceLastCheck > 10 * 60 * 1000; // 10 minutes
      
      if (!statusChanged && !needsHeartbeat) {
        console.log(`No change: ${userId} - skipping tracking`);
        return null;
      }
      
      // Update tracking time
      this.lastTrackingTime.set(userId, now);
      
      // Call database function
      const { data, error } = await supabase.rpc('smart_track_presence_session', {
        user_id_param: parseInt(userId),
        is_online_param: isOnline,
        is_in_game_param: currentStatus.isInGame || false,
        in_bedwars_param: currentStatus.inBedwars || false,
        place_id_param: currentStatus.placeId || null,
        universe_id_param: currentStatus.universeId || null
      });
      
      if (error) {
        console.error('Failed to track presence:', error);
        return null;
      }
      
      console.log(`Tracked ${userId}:`, data);
      return data;
    } catch (error) {
      console.error('Activity tracking error:', error);
      return null;
    }
  }
  
  // Clean up old rate limiting data
  static cleanupRateLimiting() {
    const now = Date.now();
    const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [userId, lastTime] of this.lastTrackingTime.entries()) {
      if (lastTime < cutoff) {
        this.lastTrackingTime.delete(userId);
      }
    }
  }
  
  // Get enhanced activity data from database
  static async getActivityData(userId: string): Promise<ActivityData | null> {
    try {
      const { data, error } = await supabase
        .from('player_activity_summary')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get activity data:', error);
      return null;
    }
  }

  // Get better last seen information from presence logs
  static async getLastSeenInfo(userId: string): Promise<{
    lastSeenAccount?: string;
    lastSeenStatus?: string;
    lastSeenTimestamp?: string;
    lastSeenActivity?: string;
  } | null> {
    try {
      console.log(`🔍 getLastSeenInfo: Checking for userId ${userId}`);
      console.log(`🔍 getLastSeenInfo: Parsed userId as integer: ${parseInt(userId)}`);
      
      // Get last seen information from player_activity_summary table
      const { data, error } = await supabase
        .from('player_activity_summary')
        .select('username, user_id, last_seen_online, is_in_game, in_bedwars')
        .eq('user_id', parseInt(userId))
        .not('last_seen_online', 'is', null) // Only get records with last seen data
        .single();
      
      console.log(`🔍 getLastSeenInfo: Query result for ${userId}:`, { data, error });
      
      if (error || !data || !data.last_seen_online) {
        console.log(`❌ getLastSeenInfo: No last seen data found for ${userId}`);
        return null;
      }
      
      // Determine the activity status based on the last known state
      let lastSeenStatus: string | undefined;
      let lastSeenActivity: string | undefined;
      
      if (data.in_bedwars) {
        lastSeenStatus = 'in_bedwars';
        lastSeenActivity = 'In BedWars';
      } else if (data.is_in_game) {
        lastSeenStatus = 'in_game';
        lastSeenActivity = 'In Game';
      }
      // If neither in_bedwars nor is_in_game, we still show "online" as a fallback
      else {
        lastSeenStatus = 'online';
        lastSeenActivity = 'Online';
      }
      
      console.log(`🔍 getLastSeenInfo: Activity status for ${userId}:`, { 
        in_bedwars: data.in_bedwars, 
        is_in_game: data.is_in_game, 
        lastSeenStatus, 
        lastSeenActivity 
      });
      
      const result = {
        lastSeenAccount: data.username || `User ${userId}`,
        lastSeenStatus,
        lastSeenTimestamp: data.last_seen_online,
        lastSeenActivity
      };
      
      console.log(`✅ getLastSeenInfo: Returning result for ${userId}:`, result);
      return result;
    } catch (error) {
      console.error('Failed to get last seen info:', error);
      return null;
    }
  }

  // Get the most recent last seen activity across all accounts for a player
  static async getPlayerLastSeenInfo(playerAccounts: Array<{ user_id: number; username?: string }>): Promise<{
    lastSeenAccount?: string;
    lastSeenStatus?: string;
    lastSeenTimestamp?: string;
    lastSeenActivity?: string;
  } | null> {
    try {
      if (!playerAccounts || playerAccounts.length === 0) return null;

      // Get the most recent meaningful activity across all accounts
      const userIds = playerAccounts.map(acc => acc.user_id);
      
      const { data, error } = await supabase
        .from('roblox_presence_logs')
        .select('roblox_user_id, was_online, was_in_game, in_bedwars, detected_at, status_change_type')
        .in('roblox_user_id', userIds)
        .neq('status_change_type', 'status_check') // Exclude redundant status checks
        .order('detected_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !data) return null;
      
      // Determine the activity status - ONLY count meaningful activity (in BedWars or in game)
      let lastSeenStatus: string | undefined;
      let lastSeenActivity: string | undefined;
      
      if (data.in_bedwars) {
        lastSeenStatus = 'in_bedwars';
        lastSeenActivity = 'In BedWars';
      } else if (data.was_in_game) {
        lastSeenStatus = 'in_game';
        lastSeenActivity = 'In Game';
      }
      // Do NOT include was_online - only show "in game" or "in bedwars" status
      
      // Return information ONLY if we have meaningful activity status
      if (lastSeenStatus) {
        // Find the account that had this activity
        const account = playerAccounts.find(acc => acc.user_id === data.roblox_user_id);
        const accountName = account?.username || `User ${data.roblox_user_id}`;
        
        return {
          lastSeenAccount: accountName,
          lastSeenStatus,
          lastSeenTimestamp: data.detected_at,
          lastSeenActivity
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get player last seen info:', error);
      return null;
    }
  }
  
  // Update activity summary when needed
  static async refreshActivitySummary(userId: string) {
    try {
      const { error } = await supabase.rpc('update_activity_summary', {
        user_id_param: parseInt(userId)
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to refresh activity:', error);
    }
  }

  // Get current status from database
  static async getCurrentStatus(userId: string) {
    try {
      const { data, error } = await supabase
        .from('roblox_user_status')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get current status:', error);
      return null;
    }
  }

  // Batch update activity summaries for multiple users
  static async refreshMultipleActivitySummaries(userIds: string[]) {
    try {
      const promises = userIds.map(userId => this.refreshActivitySummary(userId));
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to refresh multiple activity summaries:', error);
    }
  }
} 