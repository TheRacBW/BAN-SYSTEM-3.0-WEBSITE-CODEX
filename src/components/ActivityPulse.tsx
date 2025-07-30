import React from 'react';
import { TrendingUp, TrendingDown, Minus, Clock, Globe, Activity } from 'lucide-react';

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

const ActivityPulse: React.FC<ActivityPulseProps> = ({
  dailyMinutesToday,
  weeklyAverage,
  activityTrend,
  preferredTimePeriod,
  lastOnlineTimestamp,
  isCurrentlyOnline,
  detectedTimezone,
  peakHoursStart,
  peakHoursEnd,
  activityDistribution,
  compact = false,
  showTimezoneAnalysis = true,
  showDetailedStats = true
}) => {
  // Calculate activity level
  const getActivityLevel = () => {
    if (weeklyAverage >= 120) return { 
      level: 'Very Active', 
      color: 'text-green-600 dark:text-green-400', 
      bgColor: 'bg-green-100 dark:bg-green-900/30', 
      icon: '🔥' 
    };
    if (weeklyAverage >= 60) return { 
      level: 'Moderately Active', 
      color: 'text-yellow-600 dark:text-yellow-400', 
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', 
      icon: '⚡' 
    };
    if (weeklyAverage >= 15) return { 
      level: 'Lightly Active', 
      color: 'text-blue-600 dark:text-blue-400', 
      bgColor: 'bg-blue-100 dark:bg-blue-900/30', 
      icon: '💧' 
    };
    return { 
      level: 'Inactive', 
      color: 'text-gray-700 dark:text-gray-300', 
      bgColor: 'bg-gray-200 dark:bg-gray-700', 
      icon: '😴' 
    };
  };

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

  // Format time period
  const getTimePeriodDisplay = () => {
    const periodMap = {
      morning: { text: 'mornings', emoji: '🌅' },
      afternoon: { text: 'afternoons', emoji: '☀️' },
      evening: { text: 'evenings', emoji: '🌆' },
      night: { text: 'nights', emoji: '🌙' },
      unknown: { text: 'various times', emoji: '❓' }
    };
    return periodMap[preferredTimePeriod] || periodMap.unknown;
  };

  // Format peak hours
  const getPeakHoursDisplay = () => {
    if (!peakHoursStart || !peakHoursEnd) return null;
    
    const formatHour = (hour: number) => {
      if (hour === 0) return '12am';
      if (hour === 12) return '12pm';
      if (hour > 12) return `${hour - 12}pm`;
      return `${hour}am`;
    };
    
    return `${formatHour(peakHoursStart)}-${formatHour(peakHoursEnd)}`;
  };

  // Format time since last online
  const getLastSeenDisplay = () => {
    if (!lastOnlineTimestamp) return null;
    
    const now = new Date();
    const lastOnline = new Date(lastOnlineTimestamp);
    const diffMs = now.getTime() - lastOnline.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Recently';
  };

  // Get timezone display
  const getTimezoneDisplay = () => {
    if (!detectedTimezone || detectedTimezone === 'unknown') return null;
    
    const peakHours = getPeakHoursDisplay();
    if (peakHours) {
      return `${detectedTimezone} (${peakHours})`;
    }
    return detectedTimezone;
  };

  const activityLevel = getActivityLevel();
  const trendIndicator = getTrendIndicator();
  const timePeriod = getTimePeriodDisplay();
  const lastSeen = getLastSeenDisplay();
  const timezoneDisplay = getTimezoneDisplay();

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-1 px-3 py-2 rounded-lg ${activityLevel.bgColor}`}>
          <span className="text-sm">{activityLevel.icon}</span>
          <span className={`font-medium ${activityLevel.color}`}>
            {activityLevel.level}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <trendIndicator.icon size={14} className={trendIndicator.color} />
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {Math.round(weeklyAverage)}m/day
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
                {activityLevel.level}
              </div>
              <div className="text-xs text-gray-700 dark:text-gray-300">
                {Math.round(weeklyAverage)}m/day average
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
          <span className="font-medium">{dailyMinutesToday}m</span>
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

      {/* Timezone Analysis */}
      {showTimezoneAnalysis && timezoneDisplay && (
        <div className="flex items-center gap-2 text-sm">
          <Globe size={16} className="text-gray-500 dark:text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">Most active:</span>
          <span className="font-medium">{timezoneDisplay}</span>
        </div>
      )}

      {/* Detailed Stats (optional) */}
      {showDetailedStats && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>Weekly total: {Math.round(weeklyAverage * 7)}m</div>
            <div>Daily average: {Math.round(weeklyAverage)}m</div>
            {activityDistribution && (
              <div>Activity spread: {Object.keys(activityDistribution).length} hours</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityPulse; 