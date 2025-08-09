/**
 * Frontend-Only Activity Pulse Calculator
 * 
 * Calculates activity pulse data using browser session tracking
 * without relying on database activity storage.
 */

interface UserStatus {
  user_id: string;
  username?: string;
  is_online?: boolean;
  is_in_game?: boolean;
  in_bedwars?: boolean;
  last_updated?: string;
  // Activity fields from database
  daily_minutes_today?: number;
  daily_minutes_yesterday?: number;
  weekly_average?: number;
  activity_trend?: 'increasing' | 'decreasing' | 'stable';
  peak_hours_start?: number;
  peak_hours_end?: number;
  session_start_time?: string;
}

interface ActivityPulseData {
  dailyMinutesToday: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: string;
  lastOnlineTimestamp?: string;
  isCurrentlyOnline: boolean;
  peakHoursStart?: number;
  peakHoursEnd?: number;
}

// Note: Removed browser memory session tracking as it was unreliable and caused inaccurate data
// Now using database values directly for consistency and accuracy

export const calculateActivityPulse = (userStatus: UserStatus): ActivityPulseData => {
  const now = new Date();
  
  // Only count meaningful activity: in_bedwars or is_in_game (not just online)
  const isCurrentlyActive = Boolean(userStatus.is_in_game || userStatus.in_bedwars);
  
  // Use database values directly instead of browser memory
  // This avoids issues with page refreshes and provides consistent data
  let dailyMinutesToday = 0;
  let weeklyAverage = 0;

  if (userStatus.daily_minutes_today !== undefined) {
    dailyMinutesToday = userStatus.daily_minutes_today;
  }
  
  if (userStatus.weekly_average !== undefined) {
    weeklyAverage = userStatus.weekly_average;
  } else {
    // Fallback to a more realistic estimate if no weekly data exists
    // Use yesterday's data plus today's data to estimate weekly average
    const yesterdayMinutes = userStatus.daily_minutes_yesterday || 0;
    const totalRecentMinutes = dailyMinutesToday + yesterdayMinutes;
    
    // Conservative estimate: assume this 2-day pattern represents the week
    weeklyAverage = Math.min(300, Math.max(15, totalRecentMinutes / 2)); // Cap at 5 hours/day average
  }

  // Cap daily minutes to realistic maximum (12 hours = 720 minutes)
  // This prevents unrealistic 24+ hour calculations
  dailyMinutesToday = Math.min(720, Math.max(0, dailyMinutesToday));
  weeklyAverage = Math.min(300, Math.max(0, weeklyAverage)); // Cap at 5 hours/day average

  // Determine activity trend based on recent activity patterns
  let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  
  // Use database trend if available (more accurate than frontend calculation)
  if (userStatus.activity_trend) {
    activityTrend = userStatus.activity_trend;
  } else {
    // Fallback calculation only if no database trend exists
    const yesterdayMinutes = userStatus.daily_minutes_yesterday || 0;
    
    if (dailyMinutesToday > yesterdayMinutes * 1.3) {
      activityTrend = 'increasing';
    } else if (dailyMinutesToday < yesterdayMinutes * 0.7 && yesterdayMinutes > 0) {
      activityTrend = 'decreasing';
    }
  }

  // Get current time period
  const currentHour = now.getHours();
  const preferredTimePeriod = currentHour >= 6 && currentHour < 12 ? 'morning' :
                             currentHour >= 12 && currentHour < 17 ? 'afternoon' :
                             currentHour >= 17 && currentHour < 22 ? 'evening' : 'night';

  return {
    dailyMinutesToday: Math.round(dailyMinutesToday),
    weeklyAverage: Math.round(weeklyAverage),
    activityTrend,
    preferredTimePeriod,
    lastOnlineTimestamp: userStatus.last_updated,
    isCurrentlyOnline: isCurrentlyActive, // Use meaningful activity instead of just online
    peakHoursStart: userStatus.peak_hours_start || Math.max(0, currentHour - 1),
    peakHoursEnd: userStatus.peak_hours_end || Math.min(23, currentHour + 1)
  };
};

// Aggregate activity across multiple accounts for a player
export const calculateAggregatedActivityPulse = (playerAccounts: any[]): ActivityPulseData => {
  if (!playerAccounts || playerAccounts.length === 0) {
    return {
      dailyMinutesToday: 0,
      weeklyAverage: 0,
      activityTrend: 'stable',
      preferredTimePeriod: 'unknown',
      isCurrentlyOnline: false
    };
  }

  // Calculate activity for each account using database values
  const accountActivities = playerAccounts.map(account => {
    const status = account.status || {};
    return calculateActivityPulse({
      user_id: account.user_id?.toString() || account.id,
      username: status.username,
      is_online: status.isOnline,
      is_in_game: status.isInGame,
      in_bedwars: status.inBedwars,
      last_updated: status.lastUpdated,
      // Pass through database activity values
      daily_minutes_today: status.dailyMinutesToday,
      daily_minutes_yesterday: status.dailyMinutesYesterday,
      weekly_average: status.weeklyAverage,
      activity_trend: status.activityTrend,
      peak_hours_start: status.peakHoursStart,
      peak_hours_end: status.peakHoursEnd
    });
  });

  // FIXED: Use maximum daily minutes instead of sum (players can't play multiple accounts simultaneously)
  const maxDailyMinutes = Math.max(...accountActivities.map(activity => activity.dailyMinutesToday), 0);
  const totalDailyMinutes = Math.min(720, maxDailyMinutes);
  
  // Weekly average can be averaged across accounts (represents different play patterns)
  const validWeeklyAverages = accountActivities.map(activity => activity.weeklyAverage).filter(avg => avg > 0);
  const avgWeeklyAverage = validWeeklyAverages.length > 0
    ? Math.min(300, validWeeklyAverages.reduce((sum, avg) => sum + avg, 0) / validWeeklyAverages.length)
    : 0;
  
  // Check if any account has meaningful activity (in_bedwars or is_in_game)
  const hasMeaningfulActivity = playerAccounts.some(account => {
    const status = account.status || {};
    return status.inBedwars || status.isInGame;
  });
  
  // Use most optimistic trend
  let aggregatedTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (accountActivities.some(a => a.activityTrend === 'increasing')) {
    aggregatedTrend = 'increasing';
  } else if (accountActivities.every(a => a.activityTrend === 'decreasing')) {
    aggregatedTrend = 'decreasing';
  }

  // Use most common time period
  const timePeriods = accountActivities.map(a => a.preferredTimePeriod);
  const preferredTimePeriod = getMostCommon(timePeriods) || 'unknown';

  // Most recent last online timestamp
  const lastOnlineTimestamps = accountActivities
    .map(a => a.lastOnlineTimestamp)
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime());

  return {
    dailyMinutesToday: Math.round(totalDailyMinutes),
    weeklyAverage: Math.round(avgWeeklyAverage),
    activityTrend: aggregatedTrend,
    preferredTimePeriod,
    lastOnlineTimestamp: lastOnlineTimestamps[0],
    isCurrentlyOnline: hasMeaningfulActivity, // Use meaningful activity instead of just online
    peakHoursStart: accountActivities[0]?.peakHoursStart,
    peakHoursEnd: accountActivities[0]?.peakHoursEnd
  };
};

// Helper function
const getMostCommon = (arr: string[]): string => {
  const counts = arr.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
};

// Note: Session cleanup no longer needed as we use database values directly
// This provides more accurate and persistent tracking across page refreshes 