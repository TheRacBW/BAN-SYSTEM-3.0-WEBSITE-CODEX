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
 * Improved activity level determination with realistic gaming thresholds
 */
export const getActivityLevel = (
  dailyMinutes: number, 
  weeklyAverage: number, 
  isCurrentlyOnline: boolean = false
) => {
  // Use a weighted average of daily and weekly for more stable classification
  const recentActivity = Math.max(dailyMinutes, weeklyAverage * 0.8);
  
  // Different thresholds for online vs offline users with improved colors
  if (isCurrentlyOnline) {
    // Online users get boosted classification since they're actively playing
    if (recentActivity >= 180) return { 
      level: 'very_high', 
      label: 'Hardcore Player', 
      color: 'text-purple-100', 
      bgColor: 'bg-purple-600/80 border border-purple-400/30',
      icon: '👑',
      description: '3+ hours today'
    };
    if (recentActivity >= 90) return { 
      level: 'high', 
      label: 'Very Active', 
      color: 'text-green-100', 
      bgColor: 'bg-green-600/80 border border-green-400/30',
      icon: '🔥',
      description: '1.5+ hours today'
    };
    if (recentActivity >= 30) return { 
      level: 'medium', 
      label: 'Active', 
      color: 'text-yellow-100', 
      bgColor: 'bg-yellow-600/80 border border-yellow-400/30',
      icon: '⚡',
      description: '30+ minutes today'
    };
    // Online users are at least "Active" regardless of history
    return { 
      level: 'active_online', 
      label: 'Active Now', 
      color: 'text-blue-100', 
      bgColor: 'bg-blue-600/80 border border-blue-400/30',
      icon: '💧',
      description: 'Currently playing'
    };
  }
  
  // For offline users, use historical patterns with muted colors
  if (recentActivity >= 240) return { 
    level: 'very_high', 
    label: 'Hardcore Player', 
    color: 'text-purple-300', 
    bgColor: 'bg-purple-900/40 border border-purple-500/20',
    icon: '👑',
    description: '4+ hours daily'
  };
  if (recentActivity >= 120) return { 
    level: 'high', 
    label: 'Very Active', 
    color: 'text-green-300', 
    bgColor: 'bg-green-900/40 border border-green-500/20',
    icon: '🔥',
    description: '2+ hours daily'
  };
  if (recentActivity >= 60) return { 
    level: 'medium', 
    label: 'Active', 
    color: 'text-yellow-300', 
    bgColor: 'bg-yellow-900/40 border border-yellow-500/20',
    icon: '⚡',
    description: '1+ hour daily'
  };
  if (recentActivity >= 15) return { 
    level: 'low', 
    label: 'Casual Player', 
    color: 'text-blue-300', 
    bgColor: 'bg-blue-900/40 border border-blue-500/20',
    icon: '💧',
    description: '15+ minutes daily'
  };
  return { 
    level: 'inactive', 
    label: 'Inactive', 
    color: 'text-gray-400', 
    bgColor: 'bg-gray-800/40 border border-gray-600/20',
    icon: '😴',
    description: 'Limited activity'
  };
};

/**
 * Enhanced timezone detection based on activity patterns
 */
export const detectTimezoneFromPattern = (activityDistribution: Record<string, number>): string => {
  if (!activityDistribution || Object.keys(activityDistribution).length < 3) {
    return 'Unknown';
  }

  // Find peak activity hours
  const sortedActivity = Object.entries(activityDistribution)
    .map(([hour, minutes]) => ({ hour: parseInt(hour), minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 6); // Top 6 hours for better pattern detection

  if (sortedActivity.length === 0) return 'Unknown';

  // Calculate average peak hour
  const avgPeakHour = sortedActivity.reduce((sum, entry) => sum + entry.hour, 0) / sortedActivity.length;
  const totalActivity = sortedActivity.reduce((sum, entry) => sum + entry.minutes, 0);
  
  // Only make determinations if there's sufficient activity data
  if (totalActivity < 180) return 'Unknown'; // Less than 3 hours total

  // More sophisticated timezone mapping based on typical gaming patterns
  if (avgPeakHour >= 19 && avgPeakHour <= 23) {
    // Evening players (7-11 PM) - most common pattern
    return 'EST/EDT (US East)';
  } else if (avgPeakHour >= 20 && avgPeakHour <= 24) {
    // Late evening (8 PM - midnight)
    return 'PST/PDT (US West)';
  } else if (avgPeakHour >= 15 && avgPeakHour <= 19) {
    // Afternoon players (3-7 PM) 
    return 'GMT/BST (UK)';
  } else if (avgPeakHour >= 21 || avgPeakHour <= 2) {
    // Late night (9 PM - 2 AM)
    return 'CET/CEST (EU)';
  } else if (avgPeakHour >= 0 && avgPeakHour <= 6) {
    // Very late night/early morning
    return 'JST (Japan)';
  } else if (avgPeakHour >= 6 && avgPeakHour <= 12) {
    // Morning players
    return 'AEST (Australia)';
  } else if (avgPeakHour >= 12 && avgPeakHour <= 17) {
    // Afternoon
    return 'EST/EDT (US East)';
  }

  return 'EST/EDT (US East)'; // Most common fallback
};

/**
 * Quick timezone estimate for current activity
 */
export const detectCurrentTimezone = (currentHour: number, isOnline: boolean): string => {
  if (!isOnline) return 'Unknown';
  
  const localTime = new Date();
  const utcHour = localTime.getUTCHours();
  
  // Estimate timezone based on when someone is likely to be gaming
  if (currentHour >= 19 && currentHour <= 23) {
    return 'EST/EDT (Evening Gaming)';
  } else if (currentHour >= 14 && currentHour <= 18) {
    return 'EST/EDT (Afternoon Gaming)';
  } else if (currentHour >= 0 && currentHour <= 6) {
    return 'PST/PDT or Late Night';
  }
  
  return 'EST/EDT'; // Default fallback
};

/**
 * Enhanced peak hours calculation with rolling windows and pattern detection
 */
export const calculatePeakHours = (activityDistribution: Record<string, number>) => {
  if (!activityDistribution || Object.keys(activityDistribution).length === 0) {
    return { 
      start: null, 
      end: null, 
      display: 'Not enough data',
      confidence: 0,
      pattern: 'unknown'
    };
  }
  
  // Convert to array with proper hour handling
  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    minutes: activityDistribution[hour.toString()] || 0
  }));
  
  // Calculate rolling 3-hour windows for better pattern detection
  const windowSize = 3;
  const windows = [];
  
  for (let i = 0; i < 24; i++) {
    let windowTotal = 0;
    const windowHours = [];
    
    for (let j = 0; j < windowSize; j++) {
      const hourIndex = (i + j) % 24;
      windowTotal += hourlyData[hourIndex].minutes;
      windowHours.push(hourIndex);
    }
    
    windows.push({
      startHour: i,
      endHour: (i + windowSize - 1) % 24,
      totalMinutes: windowTotal,
      averageMinutes: windowTotal / windowSize,
      hours: windowHours
    });
  }
  
  // Find the best window
  const bestWindow = windows.reduce((best, current) => 
    current.totalMinutes > best.totalMinutes ? current : best
  );
  
  // Calculate confidence based on how much better the peak is vs average
  const totalActivity = hourlyData.reduce((sum, h) => sum + h.minutes, 0);
  const averageActivity = totalActivity / 24;
  const confidence = totalActivity > 0 ? 
    Math.min(100, (bestWindow.averageMinutes / averageActivity - 1) * 100) : 0;
  
  // Detect activity pattern
  let pattern = 'scattered';
  if (confidence > 50) {
    if (bestWindow.startHour >= 6 && bestWindow.startHour <= 12) {
      pattern = 'morning';
    } else if (bestWindow.startHour >= 12 && bestWindow.startHour <= 17) {
      pattern = 'afternoon';
    } else if (bestWindow.startHour >= 17 && bestWindow.startHour <= 22) {
      pattern = 'evening';
    } else {
      pattern = 'night';
    }
  }
  
  // Find actual peak range within the window for more precise display
  const peakHours = bestWindow.hours
    .map(hour => ({ hour, minutes: hourlyData[hour].minutes }))
    .filter(h => h.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  
  if (peakHours.length === 0) {
    return { 
      start: null, 
      end: null, 
      display: 'No significant activity',
      confidence: 0,
      pattern: 'none'
    };
  }
  
  // Get the actual range of significant activity
  const significantHours = peakHours
    .filter(h => h.minutes >= bestWindow.averageMinutes * 0.7)
    .map(h => h.hour)
    .sort((a, b) => a - b);
  
  const start = significantHours[0];
  const end = significantHours[significantHours.length - 1];
  
  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${period}`;
  };
  
  const formatRange = () => {
    if (start === end) {
      return `${formatHour(start)} (${Math.round(confidence)}% confidence)`;
    }
    
    // Handle wrap-around (e.g., 11PM-1AM)
    if (end < start) {
      return `${formatHour(start)}-${formatHour(end)} (overnight)`;
    }
    
    return `${formatHour(start)}-${formatHour(end)}`;
  };
  
  return {
    start,
    end,
    display: formatRange(),
    confidence: Math.round(confidence),
    pattern,
    peakWindow: bestWindow,
    totalActivity: Math.round(totalActivity)
  };
};

/**
 * Get peak hours insights and recommendations
 */
export const getPeakHoursInsights = (peakData: ReturnType<typeof calculatePeakHours>) => {
  const insights: string[] = [];
  
  if (peakData.confidence < 20) {
    insights.push('🤔 Activity spread throughout the day');
  } else if (peakData.confidence >= 70) {
    insights.push('🎯 Very consistent schedule');
  } else if (peakData.confidence >= 40) {
    insights.push('📅 Regular playing pattern');
  }
  
  switch (peakData.pattern) {
    case 'morning':
      insights.push('🌅 Early bird gamer');
      break;
    case 'afternoon':
      insights.push('☀️ Afternoon player');
      break;
    case 'evening':
      insights.push('🌆 Prime time gamer');
      break;
    case 'night':
      insights.push('🌙 Night owl');
      break;
  }
  
  if (peakData.totalActivity > 300) {
    insights.push('🔥 Heavy activity');
  } else if (peakData.totalActivity > 120) {
    insights.push('⚡ Moderate activity');
  }
  
  return insights;
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
 * Calculate activity streak (consecutive days with meaningful activity)
 */
export const calculateActivityStreak = (
  dailyMinutesToday: number,
  dailyMinutesYesterday: number,
  weeklyAverage: number
): { streak: number; status: 'active' | 'broken' | 'building' } => {
  const meaningfulThreshold = 15; // 15 minutes minimum
  
  const todayActive = dailyMinutesToday >= meaningfulThreshold;
  const yesterdayActive = dailyMinutesYesterday >= meaningfulThreshold;
  const weeklyActive = weeklyAverage >= meaningfulThreshold;
  
  if (todayActive && yesterdayActive) {
    // Estimate streak based on weekly pattern
    const estimatedStreak = Math.min(7, Math.floor(weeklyAverage / 30)); // Conservative estimate
    return { streak: Math.max(2, estimatedStreak), status: 'active' };
  } else if (todayActive && !yesterdayActive) {
    return { streak: 1, status: 'building' };
  } else if (!todayActive && yesterdayActive) {
    return { streak: 0, status: 'broken' };
  } else if (weeklyActive) {
    return { streak: 1, status: 'building' };
  }
  
  return { streak: 0, status: 'broken' };
};

/**
 * Enhanced activity summary with insights
 */
export const getActivityInsights = (
  dailyMinutes: number,
  weeklyAverage: number,
  activityTrend: string,
  preferredTimePeriod: string
) => {
  const insights: string[] = [];
  
  // Consistency insights
  if (Math.abs(dailyMinutes - weeklyAverage) < 30) {
    insights.push('🎯 Consistent player');
  } else if (dailyMinutes > weeklyAverage * 1.5) {
    insights.push('📈 Above average today');
  } else if (dailyMinutes < weeklyAverage * 0.5) {
    insights.push('📉 Below average today');
  }
  
  // Time pattern insights
  if (preferredTimePeriod === 'evening') {
    insights.push('🌆 Evening gamer');
  } else if (preferredTimePeriod === 'afternoon') {
    insights.push('☀️ Afternoon player');
  } else if (preferredTimePeriod === 'night') {
    insights.push('🌙 Night owl');
  } else if (preferredTimePeriod === 'morning') {
    insights.push('🌅 Early bird');
  }
  
  // Trend insights
  if (activityTrend === 'increasing') {
    insights.push('📈 Getting more active');
  } else if (activityTrend === 'decreasing') {
    insights.push('📉 Less active lately');
  }
  
  return insights;
};

/**
 * Get preferred time period display
 */
export const getTimePeriodDisplay = (preferredTimePeriod: string) => {
  const periodMap = {
    morning: { text: 'mornings', emoji: '🌅', hours: '6AM-12PM' },
    afternoon: { text: 'afternoons', emoji: '☀️', hours: '12PM-6PM' },
    evening: { text: 'evenings', emoji: '🌆', hours: '6PM-12AM' },
    night: { text: 'nights', emoji: '🌙', hours: '12AM-6AM' },
    unknown: { text: 'various times', emoji: '❓', hours: 'Mixed' }
  };
  return periodMap[preferredTimePeriod as keyof typeof periodMap] || periodMap.unknown;
}; 