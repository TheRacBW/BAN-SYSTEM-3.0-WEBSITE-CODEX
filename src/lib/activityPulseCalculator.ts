/**
 * Activity Pulse Calculator
 * 
 * Calculates activity pulse data directly from existing status data
 * without relying on the Edge Function for real-time updates.
 */

import {
  formatDuration,
  calculateDailyMinutes,
  getActivityLevel,
  detectTimezone,
  calculatePeakHours,
  validateActivityData,
  formatLastSeen,
  getTimePeriodDisplay
} from './activityPulseUtils';

export interface ActivityPulseData {
  dailyMinutesToday: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown';
  detectedTimezone?: string;
  peakHoursStart?: number;
  peakHoursEnd?: number;
  activityDistribution?: Record<string, number>;
  isCurrentlyOnline: boolean;
  lastOnlineTimestamp?: string;
}

export interface UserStatusData {
  user_id: string;
  username: string;
  is_online: boolean;
  is_in_game: boolean;
  in_bedwars: boolean;
  last_updated: string;
  daily_minutes_today?: number;
  weekly_average?: number;
  activity_trend?: string;
  preferred_time_period?: string;
  detected_timezone?: string;
  peak_hours_start?: number;
  peak_hours_end?: number;
  activity_distribution?: Record<string, number>;
  last_disconnect_time?: string;
  session_start_time?: string;
}

/**
 * Calculate activity pulse data for a single user
 */
export const calculateActivityPulse = (statusData: UserStatusData): ActivityPulseData => {
  // Validate input data
  const validatedData = validateActivityData({
    dailyMinutesToday: statusData.daily_minutes_today || 0,
    weeklyAverage: statusData.weekly_average || 0,
    isOnline: statusData.is_online || statusData.is_in_game || statusData.in_bedwars,
    lastUpdated: statusData.last_updated,
    activityTrend: statusData.activity_trend || 'stable',
    preferredTimePeriod: statusData.preferred_time_period || 'unknown',
    detectedTimezone: statusData.detected_timezone || 'unknown',
    activityDistribution: statusData.activity_distribution || {},
  });

  const isCurrentlyOnline = validatedData.isOnline;
  
  // Calculate actual daily minutes using improved utility
  const actualDailyMinutes = calculateDailyMinutes(
    validatedData.lastUpdated,
    isCurrentlyOnline,
    validatedData.dailyMinutesToday
  );
  
  // Get activity level using improved logic
  const activityLevel = getActivityLevel(actualDailyMinutes, validatedData.weeklyAverage);
  
  // Determine activity trend based on current vs previous activity
  let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (actualDailyMinutes > validatedData.weeklyAverage * 1.2) {
    activityTrend = 'increasing';
  } else if (actualDailyMinutes < validatedData.weeklyAverage * 0.8) {
    activityTrend = 'decreasing';
  }
  
  // Get timezone using improved detection
  const currentHour = new Date().getHours();
  const detectedTimezone = detectTimezone(currentHour, isCurrentlyOnline);
  
  // Calculate peak hours using improved utility
  const peakHours = calculatePeakHours(validatedData.activityDistribution);
  
  // Get time period display
  const timePeriod = getTimePeriodDisplay(validatedData.preferredTimePeriod);
  
  // Format last seen
  const lastSeen = formatLastSeen(statusData.last_disconnect_time);
  
  return {
    dailyMinutesToday: actualDailyMinutes,
    weeklyAverage: validatedData.weeklyAverage,
    activityTrend,
    preferredTimePeriod: validatedData.preferredTimePeriod,
    detectedTimezone,
    peakHoursStart: peakHours.start || undefined,
    peakHoursEnd: peakHours.end || undefined,
    activityDistribution: validatedData.activityDistribution,
    isCurrentlyOnline,
    lastOnlineTimestamp: statusData.last_disconnect_time
  };
};

/**
 * Calculate aggregated activity pulse data for multiple accounts
 */
export const calculateAggregatedActivityPulse = (accountsData: UserStatusData[]): ActivityPulseData => {
  if (accountsData.length === 0) {
    return {
      dailyMinutesToday: 0,
      weeklyAverage: 0,
      activityTrend: 'stable',
      preferredTimePeriod: 'unknown',
      isCurrentlyOnline: false
    };
  }
  
  // Aggregate daily minutes across all accounts
  const totalDailyMinutes = accountsData.reduce((sum, account) => {
    const pulseData = calculateActivityPulse(account);
    return sum + pulseData.dailyMinutesToday;
  }, 0);
  
  // Calculate average weekly average
  const avgWeeklyAverage = accountsData.reduce((sum, account) => {
    return sum + (account.weekly_average || 0);
  }, 0) / accountsData.length;
  
  // Determine overall trend
  const trends = accountsData.map(account => {
    const pulseData = calculateActivityPulse(account);
    return pulseData.activityTrend;
  });
  
  let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (trends.includes('increasing')) {
    activityTrend = 'increasing';
  } else if (trends.includes('decreasing')) {
    activityTrend = 'decreasing';
  }
  
  // Get most common preferred time period
  const timePeriods = accountsData.map(account => {
    const pulseData = calculateActivityPulse(account);
    return pulseData.preferredTimePeriod;
  }).filter(period => period !== 'unknown');
  
  const preferredTimePeriod = timePeriods.length > 0 
    ? getMostCommon(timePeriods) as any
    : 'unknown';
  
  // Check if any account is currently online
  const isCurrentlyOnline = accountsData.some(account => {
    const pulseData = calculateActivityPulse(account);
    return pulseData.isCurrentlyOnline;
  });
  
  // Get most recent last online timestamp
  const lastOnlineTimestamps = accountsData
    .map(account => account.last_disconnect_time)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());
  
  // Aggregate activity distribution
  const combinedDistribution: Record<string, number> = {};
  accountsData.forEach(account => {
    const pulseData = calculateActivityPulse(account);
    if (pulseData.activityDistribution) {
      Object.entries(pulseData.activityDistribution).forEach(([hour, minutes]) => {
        combinedDistribution[hour] = (combinedDistribution[hour] || 0) + minutes;
      });
    }
  });
  
  // Detect timezone from combined activity
  let detectedTimezone = 'unknown';
  if (Object.keys(combinedDistribution).length > 0) {
    const peakHours = Object.entries(combinedDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([hour]) => parseInt(hour));
    
    if (peakHours.length > 0) {
      const avgPeakHour = peakHours.reduce((sum, hour) => sum + hour, 0) / peakHours.length;
      
      if (avgPeakHour >= 14 && avgPeakHour <= 18) detectedTimezone = 'EST (US East)';
      else if (avgPeakHour >= 17 && avgPeakHour <= 21) detectedTimezone = 'PST (US West)';
      else if (avgPeakHour >= 19 && avgPeakHour <= 23) detectedTimezone = 'GMT (UK)';
      else if (avgPeakHour >= 21 && avgPeakHour <= 1) detectedTimezone = 'CET (EU)';
      else if (avgPeakHour >= 0 && avgPeakHour <= 4) detectedTimezone = 'JST (Japan)';
      else if (avgPeakHour >= 6 && avgPeakHour <= 10) detectedTimezone = 'AEST (Australia)';
    }
  }
  
  // Calculate peak hours from combined distribution
  let peakHoursStart: number | undefined;
  let peakHoursEnd: number | undefined;
  
  if (Object.keys(combinedDistribution).length > 0) {
    const threshold = Math.max(...Object.values(combinedDistribution)) * 0.7;
    const highActivityHours = Object.entries(combinedDistribution)
      .filter(([, minutes]) => minutes >= threshold)
      .map(([hour]) => parseInt(hour))
      .sort((a, b) => a - b);
    
    if (highActivityHours.length > 0) {
      peakHoursStart = highActivityHours[0];
      peakHoursEnd = highActivityHours[highActivityHours.length - 1];
    }
  }
  
  return {
    dailyMinutesToday: totalDailyMinutes,
    weeklyAverage: avgWeeklyAverage,
    activityTrend,
    preferredTimePeriod,
    detectedTimezone,
    peakHoursStart,
    peakHoursEnd,
    activityDistribution: combinedDistribution,
    isCurrentlyOnline,
    lastOnlineTimestamp: lastOnlineTimestamps[0]
  };
};

/**
 * Helper function to get most common value from array
 */
const getMostCommon = <T>(arr: T[]): T | null => {
  if (arr.length === 0) return null;
  
  const counts = arr.reduce((acc, val) => {
    acc[val as any] = (acc[val as any] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.keys(counts).reduce((a, b) => 
    counts[a] > counts[b] ? a : b
  ) as T;
}; 