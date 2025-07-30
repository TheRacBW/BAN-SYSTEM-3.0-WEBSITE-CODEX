/**
 * Activity Pulse Utility Functions
 * 
 * Provides proper time formatting, activity level calculation, and data validation
 * to fix the current issues with decimal minutes and poor UX.
 */

/**
 * Format duration in a user-friendly way
 */
export const formatDuration = (minutes: number): string => {
  if (isNaN(minutes) || minutes < 0) return '0m';
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

/**
 * Calculate daily minutes with proper validation and capping
 */
export const calculateDailyMinutes = (lastUpdated: string, isOnline: boolean, existingMinutes: number = 0): number => {
  if (!isOnline || !lastUpdated) return existingMinutes;
  
  try {
    const now = new Date();
    const lastUpdate = new Date(lastUpdated);
    const diffMs = now.getTime() - lastUpdate.getTime();
    const diffMinutes = Math.max(0, Math.min(480, diffMs / (1000 * 60))); // Cap at 8 hours
    
    return Math.round(existingMinutes + diffMinutes);
  } catch (error) {
    console.error('Error calculating daily minutes:', error);
    return existingMinutes;
  }
};

/**
 * Improved activity level determination
 */
export const getActivityLevel = (dailyMinutes: number, weeklyAverage: number) => {
  // Use the higher of current day or weekly average for classification
  const activeMinutes = Math.max(dailyMinutes, weeklyAverage);
  
  if (activeMinutes >= 120) return { 
    level: 'high', 
    label: 'Very Active', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '🔥' 
  };
  if (activeMinutes >= 45) return { 
    level: 'medium', 
    label: 'Active', 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: '⚡' 
  };
  if (activeMinutes >= 10) return { 
    level: 'low', 
    label: 'Light Activity', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '💧' 
  };
  return { 
    level: 'inactive', 
    label: 'Inactive', 
    color: 'text-gray-700 dark:text-gray-300', 
    bgColor: 'bg-gray-200 dark:bg-gray-700',
    icon: '😴' 
  };
};

/**
 * Improved timezone detection
 */
export const detectTimezone = (currentHour: number, isOnline: boolean): string => {
  if (!isOnline) return 'Unknown';
  
  // Use current hour to make educated guess
  if (currentHour >= 9 && currentHour <= 17) return 'EST (Business Hours)';
  if (currentHour >= 18 && currentHour <= 23) return 'EST (Evening)';
  if (currentHour >= 0 && currentHour <= 8) return 'EST (Late Night)';
  
  return 'EST'; // Default fallback
};

/**
 * Better peak hours calculation
 */
export const calculatePeakHours = (activityDistribution: Record<string, number>) => {
  if (!activityDistribution || Object.keys(activityDistribution).length === 0) {
    return { start: null, end: null, display: 'Not enough data' };
  }
  
  const sortedHours = Object.entries(activityDistribution)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3) // Top 3 hours
    .map(([hour]) => parseInt(hour))
    .sort((a, b) => a - b);
  
  if (sortedHours.length === 0) return { start: null, end: null, display: 'No activity' };
  
  const start = Math.min(...sortedHours);
  const end = Math.max(...sortedHours);
  
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };
  
  return {
    start,
    end,
    display: start === end ? formatHour(start) : `${formatHour(start)}-${formatHour(end)}`
  };
};

/**
 * Validate and sanitize activity data
 */
export const validateActivityData = (data: any) => {
  return {
    dailyMinutesToday: Math.max(0, Math.min(1440, data.dailyMinutesToday || 0)), // Cap at 24 hours
    weeklyAverage: Math.max(0, Math.min(1440, data.weeklyAverage || 0)),
    isOnline: Boolean(data.isOnline),
    lastUpdated: data.lastUpdated || new Date().toISOString(),
    activityTrend: data.activityTrend || 'stable',
    preferredTimePeriod: data.preferredTimePeriod || 'unknown',
    detectedTimezone: data.detectedTimezone || 'unknown',
    activityDistribution: data.activityDistribution || {},
  };
};

/**
 * Format time since last online in a user-friendly way
 */
export const formatLastSeen = (lastOnlineTimestamp?: string): string | null => {
  if (!lastOnlineTimestamp) return null;
  
  try {
    const now = new Date();
    const lastOnline = new Date(lastOnlineTimestamp);
    const diffMs = now.getTime() - lastOnline.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  } catch (error) {
    console.error('Error formatting last seen:', error);
    return null;
  }
};

/**
 * Get preferred time period display
 */
export const getTimePeriodDisplay = (preferredTimePeriod: string) => {
  const periodMap = {
    morning: { text: 'mornings', emoji: '🌅' },
    afternoon: { text: 'afternoons', emoji: '☀️' },
    evening: { text: 'evenings', emoji: '🌆' },
    night: { text: 'nights', emoji: '🌙' },
    unknown: { text: 'various times', emoji: '❓' }
  };
  return periodMap[preferredTimePeriod as keyof typeof periodMap] || periodMap.unknown;
}; 