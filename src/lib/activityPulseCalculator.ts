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
  // Note: These activity fields likely don't exist in your DB
  daily_minutes_today?: number;
  weekly_average?: number;
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

// Simple session storage for tracking online sessions (browser memory only)
const sessionTracker = new Map<string, { startTime: number; totalToday: number }>();

export const calculateActivityPulse = (userStatus: UserStatus): ActivityPulseData => {
  const now = new Date();
  const userId = userStatus.user_id;
  const isCurrentlyOnline = Boolean(userStatus.is_online || userStatus.is_in_game || userStatus.in_bedwars);
  
  // Get or create session tracking
  let sessionData = sessionTracker.get(userId);
  if (!sessionData) {
    sessionData = { startTime: 0, totalToday: 0 };
    sessionTracker.set(userId, sessionData);
  }

  let dailyMinutesToday = 0;
  let weeklyAverage = 0;

  if (isCurrentlyOnline) {
    // User is online - calculate session time
    const lastUpdated = userStatus.last_updated ? new Date(userStatus.last_updated) : now;
    
    // If this is a new session, start tracking
    if (sessionData.startTime === 0) {
      sessionData.startTime = lastUpdated.getTime();
    }
    
    // Calculate current session duration
    const sessionMinutes = Math.max(0, (now.getTime() - sessionData.startTime) / 60000);
    dailyMinutesToday = Math.round(sessionData.totalToday + sessionMinutes);
    
    // Estimate weekly average based on current session (very rough)
    weeklyAverage = Math.max(15, dailyMinutesToday * 0.7); // Conservative estimate
  } else {
    // User is offline
    if (sessionData.startTime > 0) {
      // They were online before, finalize the session
      const lastUpdated = userStatus.last_updated ? new Date(userStatus.last_updated) : now;
      const sessionMinutes = Math.max(0, (lastUpdated.getTime() - sessionData.startTime) / 60000);
      sessionData.totalToday += sessionMinutes;
      sessionData.startTime = 0; // Reset session
    }
    
    dailyMinutesToday = sessionData.totalToday;
    weeklyAverage = dailyMinutesToday; // For offline users, assume this is their pattern
  }

  // Determine activity trend based on current vs estimated average
  let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (isCurrentlyOnline) {
    activityTrend = 'increasing'; // Online users are trending up
  } else if (dailyMinutesToday > weeklyAverage * 1.2) {
    activityTrend = 'increasing';
  } else if (dailyMinutesToday < weeklyAverage * 0.8) {
    activityTrend = 'decreasing';
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
    isCurrentlyOnline,
    peakHoursStart: Math.max(0, currentHour - 1),
    peakHoursEnd: Math.min(23, currentHour + 1)
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

  // Calculate activity for each account
  const accountActivities = playerAccounts.map(account => {
    const status = account.status || {};
    return calculateActivityPulse({
      user_id: account.user_id?.toString() || account.id,
      username: status.username,
      is_online: status.isOnline,
      is_in_game: status.isInGame,
      in_bedwars: status.inBedwars,
      last_updated: status.lastUpdated
    });
  });

  // Aggregate results
  const totalDailyMinutes = accountActivities.reduce((sum, activity) => sum + activity.dailyMinutesToday, 0);
  const avgWeeklyAverage = accountActivities.reduce((sum, activity) => sum + activity.weeklyAverage, 0) / accountActivities.length;
  const hasOnlineAccount = accountActivities.some(activity => activity.isCurrentlyOnline);
  
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
    dailyMinutesToday: totalDailyMinutes,
    weeklyAverage: Math.round(avgWeeklyAverage),
    activityTrend: aggregatedTrend,
    preferredTimePeriod,
    lastOnlineTimestamp: lastOnlineTimestamps[0],
    isCurrentlyOnline: hasOnlineAccount,
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

// Clean up old session data (call periodically)
export const cleanupSessionData = () => {
  // Remove sessions older than 24 hours
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  for (const [userId, data] of sessionTracker.entries()) {
    if (data.startTime < oneDayAgo && data.startTime > 0) {
      sessionTracker.delete(userId);
    }
  }
}; 