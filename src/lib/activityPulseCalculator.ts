/**
 * Activity Pulse Calculator
 * 
 * Calculates activity pulse data directly from existing status data
 * without relying on the Edge Function for real-time updates.
 */

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
  const now = new Date();
  const lastUpdated = new Date(statusData.last_updated);
  const isCurrentlyOnline = statusData.is_online || statusData.is_in_game || statusData.in_bedwars;
  
  // Calculate daily minutes based on current online status
  let dailyMinutesToday = statusData.daily_minutes_today || 0;
  
  if (isCurrentlyOnline) {
    // If currently online, add time since last update (max 30 minutes)
    const minutesSinceUpdate = Math.min(30, Math.max(0, (now.getTime() - lastUpdated.getTime()) / 60000));
    dailyMinutesToday += minutesSinceUpdate;
  }
  
  // Calculate weekly average (simplified - you could enhance this with historical data)
  const weeklyAverage = statusData.weekly_average || 0;
  
  // Determine activity trend based on current vs previous activity
  let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (dailyMinutesToday > weeklyAverage * 1.2) {
    activityTrend = 'increasing';
  } else if (dailyMinutesToday < weeklyAverage * 0.8) {
    activityTrend = 'decreasing';
  }
  
  // Determine preferred time period based on current hour
  const currentHour = now.getHours();
  const getTimePeriod = (hour: number): 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown' => {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    if (hour >= 22 || hour < 6) return 'night';
    return 'unknown';
  };
  
  const preferredTimePeriod = isCurrentlyOnline ? getTimePeriod(currentHour) : (statusData.preferred_time_period as any) || 'unknown';
  
  // Detect timezone based on current activity (simplified)
  let detectedTimezone = statusData.detected_timezone || 'unknown';
  if (isCurrentlyOnline) {
    if (currentHour >= 14 && currentHour <= 18) detectedTimezone = 'EST (US East)';
    else if (currentHour >= 17 && currentHour <= 21) detectedTimezone = 'PST (US West)';
    else if (currentHour >= 19 && currentHour <= 23) detectedTimezone = 'GMT (UK)';
    else if (currentHour >= 21 || currentHour <= 1) detectedTimezone = 'CET (EU)';
    else if (currentHour >= 0 && currentHour <= 4) detectedTimezone = 'JST (Japan)';
    else if (currentHour >= 6 && currentHour <= 10) detectedTimezone = 'AEST (Australia)';
  }
  
  // Calculate peak hours (simplified)
  let peakHoursStart: number | undefined;
  let peakHoursEnd: number | undefined;
  
  if (isCurrentlyOnline) {
    // If currently online, consider this hour as peak
    peakHoursStart = currentHour;
    peakHoursEnd = currentHour;
  } else if (statusData.peak_hours_start !== undefined && statusData.peak_hours_end !== undefined) {
    peakHoursStart = statusData.peak_hours_start;
    peakHoursEnd = statusData.peak_hours_end;
  }
  
  // Activity distribution (simplified)
  const activityDistribution = statusData.activity_distribution || {};
  if (isCurrentlyOnline) {
    const hourKey = currentHour.toString();
    activityDistribution[hourKey] = (activityDistribution[hourKey] || 0) + 1; // Add 1 minute for current activity
  }
  
  return {
    dailyMinutesToday,
    weeklyAverage,
    activityTrend,
    preferredTimePeriod,
    detectedTimezone,
    peakHoursStart,
    peakHoursEnd,
    activityDistribution,
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