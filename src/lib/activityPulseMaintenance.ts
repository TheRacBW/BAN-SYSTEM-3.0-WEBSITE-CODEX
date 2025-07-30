import { supabase } from './supabase';

/**
 * Activity Pulse Maintenance Utilities
 * 
 * This module provides functions for:
 * - Manual execution of daily resets and cleanup
 * - Monitoring system health
 * - Scheduling setup assistance
 */

export interface ActivityPulseHealth {
  totalUsers: number;
  activeToday: number;
  activeThisWeek: number;
  resetToday: number;
  inactiveWeek: number;
  inactiveMonth: number;
  avgDailyMinutes: number;
  avgWeeklyMinutes: number;
}

export interface MaintenanceResult {
  success: boolean;
  message: string;
  affectedRows?: number;
  error?: string;
}

/**
 * Manually trigger daily activity data reset
 */
export const triggerDailyReset = async (): Promise<MaintenanceResult> => {
  try {
    const { data, error } = await supabase.rpc('reset_daily_activity_data');
    
    if (error) {
      return {
        success: false,
        message: 'Failed to trigger daily reset',
        error: error.message
      };
    }

    return {
      success: true,
      message: 'Daily activity data reset completed successfully'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Error triggering daily reset',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
};

/**
 * Manually trigger activity data cleanup
 */
export const triggerDataCleanup = async (): Promise<MaintenanceResult> => {
  try {
    const { data, error } = await supabase.rpc('cleanup_activity_data');
    
    if (error) {
      return {
        success: false,
        message: 'Failed to trigger data cleanup',
        error: error.message
      };
    }

    return {
      success: true,
      message: 'Activity data cleanup completed successfully'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Error triggering data cleanup',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
};

/**
 * Set up automatic scheduling (if pg_cron is available)
 */
export const setupScheduling = async (): Promise<MaintenanceResult> => {
  try {
    const { data, error } = await supabase.rpc('setup_activity_pulse_scheduling');
    
    if (error) {
      return {
        success: false,
        message: 'Failed to set up scheduling',
        error: error.message
      };
    }

    return {
      success: true,
      message: 'Activity Pulse scheduling configured successfully'
    };
  } catch (err) {
    return {
      success: false,
      message: 'Error setting up scheduling',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
};

/**
 * Get Activity Pulse system health metrics
 */
export const getSystemHealth = async (): Promise<ActivityPulseHealth | null> => {
  try {
    const { data, error } = await supabase
      .from('activity_pulse_health')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching system health:', error);
      return null;
    }

    return {
      totalUsers: data.total_users || 0,
      activeToday: data.active_today || 0,
      activeThisWeek: data.active_this_week || 0,
      resetToday: data.reset_today || 0,
      inactiveWeek: data.inactive_week || 0,
      inactiveMonth: data.inactive_month || 0,
      avgDailyMinutes: data.avg_daily_minutes || 0,
      avgWeeklyMinutes: data.avg_weekly_minutes || 0
    };
  } catch (err) {
    console.error('Error getting system health:', err);
    return null;
  }
};

/**
 * Get detailed activity statistics for monitoring
 */
export const getActivityStats = async () => {
  try {
    const { data, error } = await supabase
      .from('roblox_user_status')
      .select(`
        daily_minutes_today,
        weekly_average,
        activity_trend,
        preferred_time_period,
        detected_timezone,
        last_updated
      `)
      .not('daily_minutes_today', 'is', null);

    if (error) {
      console.error('Error fetching activity stats:', error);
      return null;
    }

    const stats = {
      totalActive: data.length,
      averageDailyMinutes: data.reduce((sum, row) => sum + (row.daily_minutes_today || 0), 0) / data.length,
      averageWeeklyMinutes: data.reduce((sum, row) => sum + (row.weekly_average || 0), 0) / data.length,
      trendDistribution: data.reduce((acc, row) => {
        const trend = row.activity_trend || 'stable';
        acc[trend] = (acc[trend] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      timePeriodDistribution: data.reduce((acc, row) => {
        const period = row.preferred_time_period || 'unknown';
        acc[period] = (acc[period] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      timezoneDistribution: data.reduce((acc, row) => {
        const tz = row.detected_timezone || 'unknown';
        acc[tz] = (acc[tz] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return stats;
  } catch (err) {
    console.error('Error getting activity stats:', err);
    return null;
  }
};

/**
 * Check if maintenance is needed based on health metrics
 */
export const checkMaintenanceNeeded = async (): Promise<{
  needsReset: boolean;
  needsCleanup: boolean;
  recommendations: string[];
}> => {
  const health = await getSystemHealth();
  
  if (!health) {
    return {
      needsReset: false,
      needsCleanup: false,
      recommendations: ['Unable to fetch system health data']
    };
  }

  const recommendations: string[] = [];
  let needsReset = false;
  let needsCleanup = false;

  // Check if daily reset is needed (if no users were reset today)
  if (health.resetToday === 0 && health.activeToday > 0) {
    needsReset = true;
    recommendations.push('Daily reset needed - no users reset today');
  }

  // Check if cleanup is needed (if there are many inactive users)
  if (health.inactiveMonth > health.totalUsers * 0.1) { // More than 10% inactive for a month
    needsCleanup = true;
    recommendations.push(`Cleanup recommended - ${health.inactiveMonth} users inactive for 30+ days`);
  }

  // Check for unusual activity patterns
  if (health.avgDailyMinutes > 480) { // More than 8 hours average
    recommendations.push('High average daily minutes detected - consider investigating');
  }

  if (health.activeToday === 0 && health.totalUsers > 0) {
    recommendations.push('No active users today - check system status');
  }

  return {
    needsReset,
    needsCleanup,
    recommendations
  };
};

/**
 * Manual scheduling instructions for environments without pg_cron
 */
export const getManualSchedulingInstructions = (): string => {
  return `
Activity Pulse Manual Scheduling Instructions
============================================

If pg_cron extension is not available, set up manual scheduling:

1. Daily Reset (Midnight):
   - Schedule: 0 0 * * *
   - Command: SELECT reset_daily_activity_data();

2. Weekly Cleanup (Sunday 2 AM):
   - Schedule: 0 2 * * 0  
   - Command: SELECT cleanup_activity_data();

Options for manual scheduling:

A. Using cron (Linux/macOS):
   Add to crontab: crontab -e
   0 0 * * * psql -d your_database -c "SELECT reset_daily_activity_data();"
   0 2 * * 0 psql -d your_database -c "SELECT cleanup_activity_data();"

B. Using Windows Task Scheduler:
   Create scheduled tasks to run PowerShell scripts that connect to your database

C. Using Supabase Edge Functions:
   Create scheduled functions that call these maintenance procedures

D. Using external services (Zapier, IFTTT, etc.):
   Set up webhooks to trigger maintenance functions

Monitoring:
- Use getSystemHealth() to monitor system status
- Use checkMaintenanceNeeded() to determine if manual intervention is required
- Check activity_pulse_health view in database for detailed metrics
`;
}; 