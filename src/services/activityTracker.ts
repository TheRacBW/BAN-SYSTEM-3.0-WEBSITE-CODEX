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