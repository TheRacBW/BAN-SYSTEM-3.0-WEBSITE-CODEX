import React from 'react';
import { TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { 
  getActivityLevel, 
  formatDuration as formatDurationUtil, 
  calculateActivityStreak,
  getActivityInsights
} from '../lib/activityPulseUtils';

interface ActivityPulseProps {
  dailyMinutesToday: number;
  weeklyAverage: number;
  activityTrend: 'increasing' | 'decreasing' | 'stable';
  preferredTimePeriod: string;
  lastOnlineTimestamp?: string;
  isCurrentlyOnline: boolean;
  compact?: boolean;
  detectedTimezone?: string;
  peakHoursStart?: number;
  peakHoursEnd?: number;
  // New props for last seen with account info
  lastSeenAccount?: string;
  lastSeenStatus?: string; // 'in_game', 'in_bedwars'
  lastSeenTimestamp?: string; // Timestamp from presence logs
}

const ActivityPulse: React.FC<ActivityPulseProps> = ({
  dailyMinutesToday,
  weeklyAverage,
  activityTrend,
  preferredTimePeriod,
  lastOnlineTimestamp,
  isCurrentlyOnline,
  compact = false,
  peakHoursStart,
  peakHoursEnd,
  lastSeenAccount,
  lastSeenStatus,
  lastSeenTimestamp
}) => {
  // Debug logging
  console.log('🔍 ActivityPulse props:', {
    isCurrentlyOnline,
    lastSeenAccount,
    lastSeenStatus,
    lastSeenTimestamp,
    lastOnlineTimestamp
  });
  
  // Use improved duration formatting from utilities
  const formatDuration = formatDurationUtil;

  // Use improved activity level calculation from utilities
  const activityLevel = getActivityLevel(dailyMinutesToday, weeklyAverage, isCurrentlyOnline);
  
  // Calculate activity insights and streak
  const insights = getActivityInsights(
    dailyMinutesToday,
    weeklyAverage,
    activityTrend,
    preferredTimePeriod
  );
  
  const streakData = calculateActivityStreak(
    dailyMinutesToday,
    0, // We don't have yesterday's data in props, so use 0
    weeklyAverage
  );

  // Format peak hours
  const formatPeakHours = () => {
    if (!peakHoursStart && !peakHoursEnd) return 'Not enough data';
    
    const formatHour = (hour: number) => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}${period}`;
    };

    if (peakHoursStart === peakHoursEnd) {
      return formatHour(peakHoursStart || 0);
    }
    
    return `${formatHour(peakHoursStart || 0)}-${formatHour(peakHoursEnd || 0)}`;
  };

  // Format last seen
  const formatLastSeen = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
    return 'Long time ago';
  };

  // Format last seen status with account info
  const formatLastSeenWithAccount = (): string => {
    // Use lastSeenTimestamp from presence logs if available, otherwise fallback to lastOnlineTimestamp
    const timestampToUse = lastSeenTimestamp || lastOnlineTimestamp;
    
    if (!timestampToUse || !lastSeenStatus) return '';
    
    const timeAgo = formatLastSeen(timestampToUse);
    const accountInfo = lastSeenAccount ? ` on ${lastSeenAccount}` : '';
    
    // Only show meaningful statuses (in_bedwars, in_game, online)
    let statusInfo = '';
    if (lastSeenStatus && (lastSeenStatus === 'in_bedwars' || lastSeenStatus === 'in_game' || lastSeenStatus === 'online')) {
      statusInfo = ` (${lastSeenStatus})`;
    }
    
    return `Last seen ${timeAgo}${accountInfo}${statusInfo}`;
  };

  // Get estimated time range based on preferred time period
  const getEstimatedTimeRange = (timePeriod: string): string => {
    switch (timePeriod) {
      case 'morning':
        return '6AM-12PM';
      case 'afternoon':
        return '12PM-6PM';
      case 'evening':
        return '6PM-12AM';
      case 'night':
        return '12AM-6AM';
      default:
        return 'various times';
    }
  };
  const peakHours = formatPeakHours();

  // Compact version for player cards
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
          ${activityLevel.bgColor} ${activityLevel.color}
          backdrop-blur-sm shadow-sm
        `}>
          <span>{activityLevel.icon}</span>
          <span>{activityLevel.label}</span>
        </div>
        
        {activityTrend !== 'stable' && (
          <div className="flex items-center">
            {activityTrend === 'increasing' ? (
              <TrendingUp size={12} className="text-green-400" />
            ) : (
              <TrendingDown size={12} className="text-red-400" />
            )}
          </div>
        )}
        
        {isCurrentlyOnline && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Live</span>
          </div>
        )}
        
        {!isCurrentlyOnline && lastSeenStatus && (lastSeenStatus === 'in_bedwars' || lastSeenStatus === 'in_game' || lastSeenStatus === 'online') && (
          <span className="text-xs text-gray-500">• {formatLastSeenWithAccount()}</span>
        )}
      </div>
    );
  }

  // Full version for modal
  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      {/* Primary Status Line - ALWAYS SHOW */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isCurrentlyOnline ? `${activityLevel.bgColor} animate-pulse` : 'bg-gray-400'}`} />
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${activityLevel.color}`}>
              {activityLevel.icon} {activityLevel.label}
            </span>
            {activityTrend !== 'stable' && (
              <div className="flex items-center gap-1">
                {activityTrend === 'increasing' ? (
                  <TrendingUp size={14} className="text-green-400" />
                ) : (
                  <TrendingDown size={14} className="text-red-400" />
                )}
                <span className="text-xs text-gray-400">
                  {activityTrend === 'increasing' ? 'Trending up' : 'Trending down'}
                </span>
              </div>
            )}
          </div>
        </div>
        {isCurrentlyOnline && (
          <span className="bg-green-500/20 text-green-400 text-sm font-medium px-2 py-1 rounded">
            Online Now
          </span>
        )}
      </div>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-gray-400 flex items-center gap-1">
            <Clock size={12} />
            Today
          </div>
          <div className="font-medium text-white text-lg">
            {formatDuration(dailyMinutesToday)}
          </div>
          {activityLevel.description && (
            <div className="text-xs text-gray-500">{activityLevel.description}</div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">Daily Average</div>
          <div className="font-medium text-white text-lg">
            {formatDuration(weeklyAverage)}
          </div>
          {streakData.streak > 0 && (
            <div className="text-xs text-orange-400">
              🔥 {streakData.streak} day streak
            </div>
          )}
        </div>
      </div>

      {/* Activity Insights */}
      {insights.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {insights.slice(0, 3).map((insight, index) => (
            <span 
              key={index}
              className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded"
            >
              {insight}
            </span>
          ))}
        </div>
      )}

      {/* Peak Time & Time Period - ALWAYS SHOW IF AVAILABLE */}
      <div className="pt-2 border-t border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Usually plays:</span>
          <div className="flex items-center gap-2">
            {preferredTimePeriod !== 'unknown' && preferredTimePeriod !== 'various times' ? (
              <span className="text-white font-medium">
                🕒 {preferredTimePeriod}
              </span>
            ) : null}
            {peakHours !== 'Not enough data' && peakHours !== '4PM-6PM' ? (
              <span className="text-white font-medium">
                • {peakHours}
              </span>
            ) : null}
            {/* Show estimated times based on current time */}
            {preferredTimePeriod !== 'unknown' && (
              <span className="text-gray-400">
                (est. {getEstimatedTimeRange(preferredTimePeriod)})
              </span>
            )}
            {/* Fallback for users with minimal data */}
            {(preferredTimePeriod === 'unknown' || preferredTimePeriod === 'various times') && 
             peakHours === 'Not enough data' && (
              <span className="text-gray-400 italic">
                Building pattern... Check back after some gameplay!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Last Seen - ONLY FOR OFFLINE USERS WITH MEANINGFUL STATUS */}
      {!isCurrentlyOnline && lastSeenStatus && (lastSeenStatus === 'in_bedwars' || lastSeenStatus === 'in_game' || lastSeenStatus === 'online') && (
        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
          {formatLastSeenWithAccount()}
        </div>
      )}
      
      {/* Debug info for offline users with no last seen data */}
      {!isCurrentlyOnline && !lastSeenStatus && (
        <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
          No recent activity data available
        </div>
      )}
    </div>
  );
};

export default ActivityPulse; 