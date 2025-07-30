import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, Globe, Activity } from 'lucide-react';
import {
  formatDuration,
  calculateDailyMinutes,
  getActivityLevel,
  detectTimezone,
  calculatePeakHours,
  validateActivityData,
  formatLastSeen,
  getTimePeriodDisplay
} from '../lib/activityPulseUtils';

export interface ActivityPulseProps {
  // Core activity data
  dailyMinutesToday: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: 'morning' | 'afternoon' | 'evening' | 'night' | 'unknown';
  lastOnlineTimestamp?: string;
  isCurrentlyOnline: boolean;
  
  // Timezone & hours data
  detectedTimezone?: string;
  peakHoursStart?: number;
  peakHoursEnd?: number;
  activityDistribution?: Record<string, number>;
  
  // Display options
  compact?: boolean;
  showTimezoneAnalysis?: boolean;
  showDetailedStats?: boolean;
}

const ActivityPulse: React.FC<ActivityPulseProps> = (props) => {
  // Validate and process input data
  const validatedData = useMemo(() => {
    return validateActivityData(props);
  }, [props]);

  // Calculate processed data with memoization
  const processedData = useMemo(() => {
    const {
      dailyMinutesToday,
      weeklyAverage,
      activityTrend,
      preferredTimePeriod,
      lastOnlineTimestamp,
      isCurrentlyOnline,
      detectedTimezone,
      activityDistribution,
      compact = false,
      showTimezoneAnalysis = true,
      showDetailedStats = true
    } = validatedData;

    // Calculate actual daily minutes (including current online time)
    const actualDailyMinutes = calculateDailyMinutes(
      lastOnlineTimestamp || new Date().toISOString(),
      isCurrentlyOnline,
      dailyMinutesToday
    );

    // Get activity level using improved logic
    const activityLevel = getActivityLevel(actualDailyMinutes, weeklyAverage);

    // Get trend indicator
    const getTrendIndicator = () => {
      switch (activityTrend) {
        case 'increasing':
          return { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', text: '📈 Trending up' };
        case 'decreasing':
          return { icon: TrendingDown, color: 'text-red-600 dark:text-red-400', text: '📉 Trending down' };
        default:
          return { icon: Minus, color: 'text-gray-600 dark:text-gray-400', text: '➖ Stable' };
      }
    };

    // Calculate peak hours
    const peakHours = calculatePeakHours(activityDistribution);

    // Get timezone display
    const currentHour = new Date().getHours();
    const timezoneDisplay = detectTimezone(currentHour, isCurrentlyOnline);

    // Get time period display
    const timePeriod = getTimePeriodDisplay(preferredTimePeriod);

    // Format last seen
    const lastSeen = formatLastSeen(lastOnlineTimestamp);

    return {
      actualDailyMinutes,
      weeklyAverage,
      activityLevel,
      trendIndicator: getTrendIndicator(),
      peakHours,
      timezoneDisplay,
      timePeriod,
      lastSeen,
      isCurrentlyOnline,
      compact,
      showTimezoneAnalysis,
      showDetailedStats
    };
  }, [validatedData]);

  const {
    actualDailyMinutes,
    weeklyAverage,
    activityLevel,
    trendIndicator,
    peakHours,
    timezoneDisplay,
    timePeriod,
    lastSeen,
    isCurrentlyOnline,
    compact,
    showTimezoneAnalysis,
    showDetailedStats
  } = processedData;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${activityLevel.bgColor}`}>
          <span className="text-sm">{activityLevel.icon}</span>
          <span className={`font-medium ${activityLevel.color}`}>
            {activityLevel.label}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <trendIndicator.icon size={14} className={trendIndicator.color} />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {formatDuration(weeklyAverage)}/day
          </span>
        </div>
        
        {isCurrentlyOnline && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 dark:text-green-400">Online</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Activity Level and Trend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${activityLevel.bgColor}`}>
            <span className="text-lg">{activityLevel.icon}</span>
            <div>
              <div className={`font-semibold ${activityLevel.color}`}>
                {activityLevel.label}
              </div>
              <div className="text-xs text-gray-700 dark:text-gray-300">
                {formatDuration(weeklyAverage)}/day average
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <trendIndicator.icon size={20} className={trendIndicator.color} />
            <span className="text-sm text-gray-700 dark:text-gray-300">{trendIndicator.text}</span>
          </div>
        </div>
        
        {isCurrentlyOnline && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Online Now</span>
          </div>
        )}
      </div>

      {/* Today's Activity */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-gray-500 dark:text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">Today:</span>
          <span className="font-medium">{formatDuration(actualDailyMinutes)}</span>
        </div>
        
        {lastSeen && !isCurrentlyOnline && (
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Clock size={14} />
            <span className="text-xs">Last seen {lastSeen}</span>
          </div>
        )}
      </div>

      {/* Time Period */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-400">Usually plays in:</span>
        <span className="flex items-center gap-1">
          <span>{timePeriod.emoji}</span>
          <span className="font-medium">{timePeriod.text}</span>
        </span>
      </div>

      {/* Peak Hours (only if we have meaningful data) */}
      {showTimezoneAnalysis && peakHours.display !== 'Not enough data' && peakHours.display !== 'No activity' && (
        <div className="flex items-center gap-2 text-sm">
          <Globe size={16} className="text-gray-500 dark:text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">Peak time:</span>
          <span className="font-medium">{timezoneDisplay} • {peakHours.display}</span>
        </div>
      )}

      {/* Detailed Stats (simplified) */}
      {showDetailedStats && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>Weekly total: {formatDuration(weeklyAverage * 7)}</div>
            <div>Daily average: {formatDuration(weeklyAverage)}</div>
            {peakHours.display !== 'Not enough data' && (
              <div>Peak activity: {peakHours.display}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityPulse; 