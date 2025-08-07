import { supabase } from '../lib/supabase';

export interface UserTimeStats {
  total_time_seconds: number;
  total_coins: number;
  coins_from_time: number;
  last_activity: string;
  active_sessions: number;
}

export interface SessionData {
  id: string;
  user_id: string;
  session_start: string;
  session_end?: string;
  duration_seconds?: number;
  coins_earned?: number;
  is_active: boolean;
  last_activity: string;
}

export class TimeTrackingService {
  private static currentSessionId: string | null = null;
  private static lastActivityUpdate: number = 0;
  private static activityInterval: NodeJS.Timeout | null = null;
  private static readonly ACTIVITY_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly SESSION_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

  // Start tracking time for the current user
  static async startTracking(userId: string): Promise<void> {
    try {
      // End any existing session first
      await this.endCurrentSession();
      
      // Start new session using database function
      const { data, error } = await supabase
        .rpc('start_user_session', { user_uuid: userId });
      
      if (error) throw error;
      
      this.currentSessionId = data;
      this.lastActivityUpdate = Date.now();
      
      // Start activity monitoring
      this.startActivityMonitoring();
      
      console.log('Time tracking started for user:', userId);
    } catch (error) {
      console.error('Error starting time tracking:', error);
    }
  }

  // End the current session and award coins
  static async endCurrentSession(): Promise<void> {
    if (!this.currentSessionId) return;
    
    try {
      // End session using database function
      const { error } = await supabase
        .rpc('end_user_session', { session_uuid: this.currentSessionId });
      
      if (error) throw error;
      
      this.currentSessionId = null;
      this.stopActivityMonitoring();
      
      console.log('Time tracking session ended');
    } catch (error) {
      console.error('Error ending time tracking session:', error);
    }
  }

  // Update user activity (called periodically)
  static async updateActivity(): Promise<void> {
    if (!this.currentSessionId) return;
    
    try {
      const { error } = await supabase
        .from('user_session_time')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', this.currentSessionId);
      
      if (error) throw error;
      
      this.lastActivityUpdate = Date.now();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }

  // Start activity monitoring
  private static startActivityMonitoring(): void {
    // Update activity every 5 minutes
    this.activityInterval = setInterval(() => {
      this.updateActivity();
    }, this.ACTIVITY_UPDATE_INTERVAL);
    
    // Set up page visibility and focus events
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    window.addEventListener('focus', this.handleWindowFocus.bind(this));
    window.addEventListener('blur', this.handleWindowBlur.bind(this));
    
    // Set up beforeunload event
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
  }

  // Stop activity monitoring
  private static stopActivityMonitoring(): void {
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
    if (document.hidden) {
      // Page is hidden, update activity
      this.updateActivity();
    } else {
      // Page is visible again, update activity
      this.updateActivity();
    }
  }

  // Handle window focus
  private static handleWindowFocus(): void {
    this.updateActivity();
  }

  // Handle window blur
  private static handleWindowBlur(): void {
    this.updateActivity();
  }

  // Handle before unload
  private static handleBeforeUnload(): void {
    // End session when user leaves the page
    this.endCurrentSession();
  }

  // Get user time statistics
  static async getUserTimeStats(userId: string): Promise<UserTimeStats | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_time_stats', { user_uuid: userId });
      
      if (error) throw error;
      
      return data?.[0] || null;
    } catch (error) {
      console.error('Error getting user time stats:', error);
      return null;
    }
  }

  // Get all user time statistics (for admin)
  static async getAllUserTimeStats(): Promise<Array<{ user_id: string } & UserTimeStats>> {
    try {
      const { data, error } = await supabase
        .from('user_coins')
        .select(`
          user_id,
          total_time_spent_seconds,
          coins,
          coins_from_time,
          last_updated,
          users!inner(email, username)
        `)
        .order('total_time_spent_seconds', { ascending: false });
      
      if (error) throw error;
      
      return data?.map(item => ({
        user_id: item.user_id,
        total_time_seconds: item.total_time_spent_seconds || 0,
        total_coins: item.coins || 0,
        coins_from_time: item.coins_from_time || 0,
        last_activity: item.last_updated,
        active_sessions: 0 // This would need a separate query for active sessions
      })) || [];
    } catch (error) {
      console.error('Error getting all user time stats:', error);
      return [];
    }
  }

  // Get current session info
  static async getCurrentSession(userId: string): Promise<SessionData | null> {
    try {
      const { data, error } = await supabase
        .from('user_session_time')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // Force update coins for a user (admin function)
  static async forceUpdateUserCoins(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('update_user_coins_from_time', { user_uuid: userId });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error forcing coin update:', error);
      throw error;
    }
  }

  // Get session history for a user
  static async getSessionHistory(userId: string, limit: number = 50): Promise<SessionData[]> {
    try {
      const { data, error } = await supabase
        .from('user_session_time')
        .select('*')
        .eq('user_id', userId)
        .order('session_start', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
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

  // Calculate coins from time
  static calculateCoinsFromTime(seconds: number): number {
    // 30 coins every 30 minutes (1800 seconds)
    return Math.floor(seconds / 1800) * 30;
  }
} 