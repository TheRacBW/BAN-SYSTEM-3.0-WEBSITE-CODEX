import { supabase } from '../lib/supabase';

export interface UserTimeStats {
  total_time_seconds: number;
  total_coins: number;
  coins_from_time: number;
  last_activity: string;
  last_coin_award_time?: string;
}

export interface CheckpointResult {
  coins_awarded: number;
  total_coins: number;
  total_time_seconds: number;
  last_activity: string;
}

export class TimeTrackingService {
  private static activityInterval: NodeJS.Timeout | null = null;
  private static readonly CHECKPOINT_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // Start tracking time for the current user
  static async startTracking(userId: string): Promise<void> {
    try {
      // Set up periodic checkpoint checks
      this.startCheckpointMonitoring();
      
      // Initial presence update
      await this.updatePresence(userId);
      
      console.log('Time tracking started for user:', userId);
    } catch (error) {
      console.error('Error starting time tracking:', error);
    }
  }

  // End tracking (cleanup)
  static async endTracking(): Promise<void> {
    this.stopCheckpointMonitoring();
    console.log('Time tracking ended');
  }

  // Update user presence and potentially award coins
  static async updatePresence(userId: string): Promise<CheckpointResult | null> {
    try {
      console.log(`Updating presence for user ${userId}...`);
      const { data, error } = await supabase
        .rpc('update_user_presence_and_award_coins', { user_uuid: userId });
      
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      const result = data?.[0];
      console.log('Presence update result:', result);
      
      if (result && result.coins_awarded > 0) {
        console.log(`Awarded ${result.coins_awarded} coins to user ${userId}`);
      } else {
        console.log('No coins awarded this time');
      }
      
      return result || null;
    } catch (error) {
      console.error('Error updating presence:', error);
      return null;
    }
  }

  // Start checkpoint monitoring
  private static startCheckpointMonitoring(): void {
    // Clear any existing interval
    this.stopCheckpointMonitoring();
    
    // Set up page visibility and focus events
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    
    // Set up beforeunload event
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // Stop checkpoint monitoring
  private static stopCheckpointMonitoring(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // Handle page visibility changes
  private static handleVisibilityChange(): void {
    // Update presence when page visibility changes
    console.log('Page visibility changed:', document.hidden ? 'hidden' : 'visible');
  }

  // Handle window focus
  private static handleWindowFocus(): void {
    console.log('Window focused');
  }

  // Handle window blur
  private static handleWindowBlur(): void {
    console.log('Window blurred');
  }

  // Handle before unload
  private static handleBeforeUnload(): void {
    console.log('Page unloading');
  }

  // Get user time statistics
  static async getUserTimeStats(userId: string): Promise<UserTimeStats | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_time_and_coin_stats', { user_uuid: userId });
      
      if (error) throw error;
      
      const result = data?.[0];
      if (!result) return null;
      
      return {
        total_time_seconds: result.total_time_seconds || 0,
        total_coins: result.total_coins || 0,
        coins_from_time: result.coins_from_time || 0,
        last_activity: result.last_activity,
        last_coin_award_time: result.last_coin_award_time
      };
    } catch (error) {
      console.error('Error getting user time stats:', error);
      return null;
    }
  }

  // Get all user time statistics (for admin)
  static async getAllUserTimeStats(): Promise<Array<{ user_id: string; email?: string; username?: string } & UserTimeStats>> {
    try {
      const { data, error } = await supabase
        .rpc('get_all_users_time_and_coin_stats');
      
      if (error) throw error;
      
      return data?.map(item => ({
        user_id: item.user_id,
        email: item.email,
        username: item.username,
        total_time_seconds: item.total_time_seconds || 0,
        total_coins: item.total_coins || 0,
        coins_from_time: item.coins_from_time || 0,
        last_activity: item.last_activity,
        last_coin_award_time: item.last_coin_award_time
      })) || [];
    } catch (error) {
      console.error('Error getting all user time stats:', error);
      return [];
    }
  }

  // Force update coins for a user (admin function)
  static async forceUpdateUserCoins(userId: string): Promise<void> {
    try {
      // This will trigger a presence update and potentially award coins
      await this.updatePresence(userId);
    } catch (error) {
      console.error('Error forcing coin update:', error);
      throw error;
    }
  }

  // Format time duration for display
  static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Calculate coins from time (for display purposes)
  static calculateCoinsFromTime(seconds: number): number {
    // 5 coins every 5 minutes (300 seconds)
    return Math.floor(seconds / 300) * 5;
  }
} 