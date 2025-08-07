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
  private static coinTimer: NodeJS.Timeout | null = null;
  private static isActive: boolean = false;
  private static currentUserId: string | null = null;
  private static readonly COIN_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static clientStartTime: number | null = null; // When client timer started
  private static lastClientAwardTime: number | null = null; // Last client-side award time

  // Start tracking time for the current user
  static async startTracking(userId: string): Promise<void> {
    try {
      this.currentUserId = userId;
      this.isActive = true;
      this.clientStartTime = Date.now();
      this.lastClientAwardTime = null;
      
      // Start the coin timer
      this.startCoinTimer();
      
      // Set up activity monitoring
      this.startActivityMonitoring();
      
      console.log('Time tracking started for user:', userId);
    } catch (error) {
      console.error('Error starting time tracking:', error);
    }
  }

  // End tracking (cleanup)
  static async endTracking(): Promise<void> {
    this.stopCoinTimer();
    this.stopActivityMonitoring();
    this.isActive = false;
    this.currentUserId = null;
    this.clientStartTime = null;
    this.lastClientAwardTime = null;
    console.log('Time tracking ended');
  }

  // Award coins to user
  static async awardCoins(userId: string, coins: number = 5): Promise<{ total_coins: number; last_coin_award_time: string } | null> {
    try {
      console.log(`Awarding ${coins} coins to user ${userId}...`);
      
      const { data, error } = await supabase
        .rpc('award_coins_to_user', { 
          user_uuid: userId, 
          coins_to_award: coins 
        });
      
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      const result = data?.[0];
      console.log('Coin award result:', result);
      
      if (result) {
        console.log(`Successfully awarded ${coins} coins. Total: ${result.total_coins}`);
        console.log(`Last coin award time: ${result.last_coin_award_time}`);
      } else {
        console.warn('No result returned from award_coins_to_user');
      }
      
      return result || null;
    } catch (error) {
      console.error('Error awarding coins:', error);
      return null;
    }
  }

  // Start coin timer
  private static startCoinTimer(): void {
    this.stopCoinTimer();
    
    console.log('Starting client-side coin timer...');
    
    // Start with a fresh 5-minute timer
    this.setupRegularInterval();
  }

  // Set up regular 5-minute interval
  private static setupRegularInterval(): void {
    this.coinTimer = setInterval(async () => {
      if (this.isActive && this.currentUserId) {
        console.log('Client-side coin timer triggered - awarding coins');
        this.lastClientAwardTime = Date.now();
        await this.awardCoins(this.currentUserId);
      } else {
        console.log('Coin timer triggered but user not active - skipping award');
      }
    }, this.COIN_INTERVAL);
  }

  // Stop coin timer
  private static stopCoinTimer(): void {
    if (this.coinTimer) {
      clearInterval(this.coinTimer);
      this.coinTimer = null;
      console.log('Coin timer stopped');
    }
  }

  // Start activity monitoring
  private static startActivityMonitoring(): void {
    this.stopActivityMonitoring();
    
    // Set up page visibility and focus events
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    
    // Periodic activity check (every 30 seconds)
    this.activityInterval = setInterval(() => {
      this.updateActivityStatus();
    }, 30000);
  }

  // Stop activity monitoring
  private static stopActivityMonitoring(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.removeEventListener('focus', this.handleWindowFocus.bind(this));
    window.removeEventListener('blur', this.handleWindowBlur.bind(this));
    window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
  }

  // Handle page visibility changes
  private static handleVisibilityChange(): void {
    this.updateActivityStatus();
  }

  // Handle window focus
  private static handleWindowFocus(): void {
    this.updateActivityStatus();
  }

  // Handle window blur
  private static handleWindowBlur(): void {
    this.updateActivityStatus();
  }

  // Handle before unload
  private static handleBeforeUnload(): void {
    console.log('Page unloading - stopping timer');
    this.isActive = false;
  }

  // Check if user is actually viewing the page
  private static isUserViewing(): boolean {
    return !document.hidden && document.hasFocus();
  }

  // Update activity status based on current state
  private static updateActivityStatus(): void {
    const shouldBeActive = this.isUserViewing();
    if (this.isActive !== shouldBeActive) {
      this.isActive = shouldBeActive;
      console.log(`Activity status changed: ${this.isActive ? 'Active' : 'Inactive'}`);
    }
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

  // Get client-side timer information
  static getClientTimerInfo(): { timeUntilNextCoins: number; lastClientAward: string | null } {
    if (!this.clientStartTime || !this.isActive) {
      return { timeUntilNextCoins: 300, lastClientAward: null };
    }

    const now = Date.now();
    const lastAward = this.lastClientAwardTime || this.clientStartTime;
    const timeSinceLastAward = now - lastAward;
    const timeUntilNext = Math.max(0, this.COIN_INTERVAL - timeSinceLastAward);

    return {
      timeUntilNextCoins: Math.floor(timeUntilNext / 1000), // Convert to seconds
      lastClientAward: this.lastClientAwardTime ? new Date(this.lastClientAwardTime).toLocaleTimeString() : null
    };
  }
} 