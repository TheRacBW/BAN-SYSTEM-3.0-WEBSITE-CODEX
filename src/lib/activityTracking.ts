import { supabase } from './supabase';

export interface UserStatus {
  userId: number;
  username: string;
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  userPresenceType: number | null;
  placeId: number | null;
  rootPlaceId: number | null;
  universeId: number | null;
  lastUpdated: number;
  presenceMethod: 'direct';
}

export interface ActivityPulseData {
  dailyMinutesToday: number;
  dailyMinutesYesterday: number;
  weeklyTotalMinutes: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown';
  detectedTimezone?: string;
  peakHoursStart?: number;
  peakHoursEnd?: number;
  activityDistribution?: Record<string, number>;
  lastDisconnectTime?: string;
  sessionStartTime?: string;
}

export interface PlayerAccount {
  id: string;
  user_id: number;
  username: string;
  status?: {
    isOnline: boolean;
    isInGame: boolean;
    inBedwars: boolean;
    lastUpdated: number;
    dailyMinutesToday?: number;
    weeklyAverage?: number;
    activityTrend?: string;
    preferredTimePeriod?: string;
    detectedTimezone?: string;
    peakHoursStart?: number;
    peakHoursEnd?: number;
    activityDistribution?: Record<string, number>;
    lastDisconnectTime?: string;
    sessionStartTime?: string;
  };
}

/**
 * Handle temporary disconnections by checking if disconnect duration is less than threshold
 */
export const isTemporaryDisconnect = (currentStatus: UserStatus, previousStatus: UserStatus): boolean => {
  const wasOnline = previousStatus.isOnline || previousStatus.isInGame || previousStatus.inBedwars;
  const isNowOffline = !currentStatus.isOnline && !currentStatus.isInGame && !currentStatus.inBedwars;
  
  if (!wasOnline || !isNowOffline) return false;
  
  const disconnectTime = new Date(currentStatus.lastUpdated).getTime();
  const lastOnlineTime = new Date(previousStatus.lastUpdated).getTime();
  const disconnectDuration = disconnectTime - lastOnlineTime;
  
  return disconnectDuration < 5 * 60 * 1000; // Less than 5 minutes
};

/**
 * Detect timezone based on activity patterns
 */
export const detectTimezoneFromActivity = (hourlyActivity: Record<string, number>): string => {
  if (!hourlyActivity || Object.keys(hourlyActivity).length === 0) {
    return 'unknown';
  }

  // Find peak activity hours
  const peakHours = Object.entries(hourlyActivity)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4)
    .map(([hour]) => parseInt(hour));
  
  if (peakHours.length === 0) return 'unknown';
  
  const avgPeakHour = peakHours.reduce((sum, hour) => sum + hour, 0) / peakHours.length;
  
  // Map peak hours to likely timezones
  if (avgPeakHour >= 14 && avgPeakHour <= 18) return 'EST (US East)';
  if (avgPeakHour >= 17 && avgPeakHour <= 21) return 'PST (US West)';
  if (avgPeakHour >= 19 && avgPeakHour <= 23) return 'GMT (UK)';
  if (avgPeakHour >= 21 && avgPeakHour <= 1) return 'CET (EU)';
  if (avgPeakHour >= 0 && avgPeakHour <= 4) return 'JST (Japan)';
  if (avgPeakHour >= 6 && avgPeakHour <= 10) return 'AEST (Australia)';
  
  return 'Unknown';
};

/**
 * Calculate peak hours from activity distribution
 */
export const calculatePeakHours = (activityDistribution: Record<string, number>): { start: number; end: number } | null => {
  if (!activityDistribution || Object.keys(activityDistribution).length === 0) {
    return null;
  }

  // Find consecutive hours with highest activity
  const entries = Object.entries(activityDistribution)
    .map(([hour, minutes]) => ({ hour: parseInt(hour), minutes }))
    .sort((a, b) => b.minutes - a.minutes);

  if (entries.length === 0) return null;

  // Find the longest consecutive range with high activity
  const threshold = Math.max(...entries.map(e => e.minutes)) * 0.7; // 70% of max activity
  const highActivityHours = entries
    .filter(e => e.minutes >= threshold)
    .map(e => e.hour)
    .sort((a, b) => a - b);

  if (highActivityHours.length === 0) return null;

  // Handle wrap-around (e.g., 22, 23, 0, 1)
  let start = highActivityHours[0];
  let end = highActivityHours[highActivityHours.length - 1];

  // If there's a gap larger than 2 hours, find the longest consecutive range
  for (let i = 0; i < highActivityHours.length - 1; i++) {
    const gap = highActivityHours[i + 1] - highActivityHours[i];
    if (gap > 2) {
      // Check if this is a wrap-around case
      if (highActivityHours[i] >= 22 && highActivityHours[i + 1] <= 2) {
        // This is a wrap-around, keep the current range
        continue;
      }
      // This is a real gap, find the longest consecutive range
      const beforeGap = highActivityHours.slice(0, i + 1);
      const afterGap = highActivityHours.slice(i + 1);
      
      if (beforeGap.length >= afterGap.length) {
        start = beforeGap[0];
        end = beforeGap[beforeGap.length - 1];
      } else {
        start = afterGap[0];
        end = afterGap[afterGap.length - 1];
      }
      break;
    }
  }

  return { start, end };
};

/**
 * Get time period based on hour
 */
export const getTimePeriod = (hour: number): 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown' => {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  if (hour >= 22 || hour < 6) return 'night';
  return 'unknown';
};

/**
 * Calculate weekly stats and trends
 */
export const calculateWeeklyStats = (todayMinutes: number, existingStatus: any): {
  total: number;
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
} => {
  const yesterdayMinutes = existingStatus?.daily_minutes_yesterday || 0;
  const previousAverage = existingStatus?.weekly_average || 0;
  
  // Cap input minutes to realistic values
  const cappedTodayMinutes = Math.min(720, Math.max(0, todayMinutes)); // Max 12 hours/day
  const cappedYesterdayMinutes = Math.min(720, Math.max(0, yesterdayMinutes));
  
  // More conservative weekly calculation based on recent 2-day pattern
  // Instead of multiplying by 3.5, use a more realistic approach
  const recentAverage = (cappedTodayMinutes + cappedYesterdayMinutes) / 2;
  const estimatedWeeklyTotal = recentAverage * 7;
  const newAverage = Math.min(300, recentAverage); // Cap average at 5 hours/day
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (newAverage > previousAverage * 1.2) trend = 'increasing';
  else if (newAverage < previousAverage * 0.8) trend = 'decreasing';
  
  return {
    total: estimatedWeeklyTotal,
    average: Math.round(newAverage * 100) / 100,
    trend
  };
};

/**
 * Aggregate multiple accounts for a player
 */
export const aggregatePlayerActivity = (playerAccounts: PlayerAccount[]): {
  totalDailyMinutes: number;
  avgWeeklyAverage: number;
  combinedDistribution: Record<string, number>;
  detectedTimezone: string;
  peakHours: { start: number; end: number } | null;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown';
  isCurrentlyOnline: boolean;
  lastOnlineTimestamp?: string;
} => {
  if (!playerAccounts || playerAccounts.length === 0) {
    return {
      totalDailyMinutes: 0,
      avgWeeklyAverage: 0,
      combinedDistribution: {},
      detectedTimezone: 'unknown',
      peakHours: null,
      activityTrend: 'stable',
      preferredTimePeriod: 'unknown',
      isCurrentlyOnline: false
    };
  }

  // Aggregate daily minutes across accounts
  const totalDailyMinutes = playerAccounts.reduce((sum, acc) => 
    sum + (acc.status?.dailyMinutesToday || 0), 0);
  
  // Calculate average weekly average
  const avgWeeklyAverage = playerAccounts.length > 0 
    ? playerAccounts.reduce((sum, acc) => sum + (acc.status?.weeklyAverage || 0), 0) / playerAccounts.length
    : 0;
  
  // Combine activity distributions
  const combinedDistribution: Record<string, number> = {};
  playerAccounts.forEach(acc => {
    const dist = acc.status?.activityDistribution || {};
    Object.entries(dist).forEach(([hour, minutes]) => {
      combinedDistribution[hour] = (combinedDistribution[hour] || 0) + minutes;
    });
  });
  
  // Detect timezone from combined activity
  const detectedTimezone = detectTimezoneFromActivity(combinedDistribution);
  
  // Calculate peak hours
  const peakHours = calculatePeakHours(combinedDistribution);
  
  // Determine overall trend (use most positive trend)
  const trends = playerAccounts
    .map(acc => acc.status?.activityTrend)
    .filter(Boolean) as ('increasing' | 'decreasing' | 'stable')[];
  
  const activityTrend = trends.includes('increasing') ? 'increasing' :
                       trends.includes('stable') ? 'stable' : 'decreasing';
  
  // Use the most common time period
  const timePeriods = playerAccounts
    .map(acc => acc.status?.preferredTimePeriod)
    .filter(Boolean) as ('morning' | 'afternoon' | 'evening' | 'night' | 'unknown')[];
  
  const preferredTimePeriod = getMostCommon(timePeriods) || 'unknown';
  
  // Check if any account is currently online
  const isCurrentlyOnline = playerAccounts.some(acc => 
    acc.status?.isOnline || acc.status?.isInGame || acc.status?.inBedwars);
  
  // Get most recent last online timestamp
  const lastOnlineTimestamps = playerAccounts
    .map(acc => acc.status?.lastDisconnectTime)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  return {
    totalDailyMinutes,
    avgWeeklyAverage,
    combinedDistribution,
    detectedTimezone,
    peakHours,
    activityTrend,
    preferredTimePeriod,
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
    counts[a] > counts[b] ? a : b) as T;
};

/**
 * Update activity pulse data for a user
 */
export const updateActivityPulseData = async (userId: number, currentStatus: UserStatus): Promise<void> => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentHour = now.getHours();
  
  // Get existing status
  const { data: existingStatus } = await supabase
    .from('roblox_user_status')
    .select(`
      is_online, is_in_game, in_bedwars, 
      daily_minutes_today, daily_minutes_yesterday,
      weekly_total_minutes, weekly_average,
      activity_trend, preferred_time_period,
      last_reset_date, last_updated,
      activity_distribution, session_start_time
    `)
    .eq('user_id', userId)
    .single();

  const wasOnlineState = existingStatus?.is_online || existingStatus?.is_in_game || existingStatus?.in_bedwars;
  const isNowOnlineState = currentStatus.isOnline || currentStatus.isInGame || currentStatus.inBedwars;
  
  let updateData: any = {
    user_id: userId,
    is_online: currentStatus.isOnline,
    is_in_game: currentStatus.isInGame,
    in_bedwars: currentStatus.inBedwars,
    last_updated: now.toISOString()
  };

  // Handle day reset
  const needsDayReset = !existingStatus?.last_reset_date || 
                       existingStatus.last_reset_date !== today;
  
  if (needsDayReset) {
    updateData.daily_minutes_yesterday = existingStatus?.daily_minutes_today || 0;
    updateData.daily_minutes_today = 0;
    updateData.last_reset_date = today;
  } else {
    updateData.daily_minutes_today = existingStatus?.daily_minutes_today || 0;
    updateData.daily_minutes_yesterday = existingStatus?.daily_minutes_yesterday || 0;
  }

  // Handle session tracking
  if (isNowOnlineState && !wasOnlineState) {
    // Starting new session
    updateData.session_start_time = now.toISOString();
  } else if (!isNowOnlineState && wasOnlineState) {
    // Ending session
    updateData.last_disconnect_time = now.toISOString();
  }

  // Calculate time online (when currently online)
  if (isNowOnlineState && existingStatus?.last_updated) {
    const lastUpdate = new Date(existingStatus.last_updated);
    const minutesSinceUpdate = Math.min(30, Math.max(0, (now.getTime() - lastUpdate.getTime()) / 60000));
    
    // Only add time if user is in meaningful activity (in_bedwars or is_in_game)
    const isMeaningfulActivity = currentStatus.inBedwars || currentStatus.isInGame;
    
    if (isMeaningfulActivity) {
      updateData.daily_minutes_today = (updateData.daily_minutes_today || 0) + minutesSinceUpdate;
      
      // Cap daily minutes to realistic maximum (12 hours = 720 minutes)
      updateData.daily_minutes_today = Math.min(720, updateData.daily_minutes_today);
    } else {
      // Just maintain current daily minutes without adding time for being merely online
      updateData.daily_minutes_today = updateData.daily_minutes_today || 0;
    }
    
    // Update activity distribution (only for meaningful activity)
    if (isMeaningfulActivity) {
      const currentDistribution = existingStatus?.activity_distribution || {};
      const hourKey = currentHour.toString();
      currentDistribution[hourKey] = (currentDistribution[hourKey] || 0) + minutesSinceUpdate;
      updateData.activity_distribution = currentDistribution;
    }
  }

  // Update preferred time period based on current activity
  if (isNowOnlineState) {
    updateData.preferred_time_period = getTimePeriod(currentHour);
  }

  // Calculate weekly stats and trends
  const weeklyStats = calculateWeeklyStats(updateData.daily_minutes_today, existingStatus);
  updateData.weekly_total_minutes = weeklyStats.total;
  updateData.weekly_average = weeklyStats.average;
  updateData.activity_trend = weeklyStats.trend;

  // Detect timezone and peak hours
  const activityDistribution = updateData.activity_distribution || existingStatus?.activity_distribution || {};
  updateData.detected_timezone = detectTimezoneFromActivity(activityDistribution);
  
  const peakHours = calculatePeakHours(activityDistribution);
  if (peakHours) {
    updateData.peak_hours_start = peakHours.start;
    updateData.peak_hours_end = peakHours.end;
  }

  await supabase
    .from('roblox_user_status')
    .upsert(updateData, {
      onConflict: 'user_id'
    });
}; 