import React from 'react';
import { TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

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
  peakHoursEnd
}) => {
  // Format duration with exact times
  const formatDuration = (minutes: number): string => {
    if (isNaN(minutes) || minutes < 0) return '0m';
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${Math.round(minutes)}m`;
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get activity level
  const getActivityLevel = (dailyMinutes: number, weeklyAvg: number, isCurrentlyOnline: boolean) => {
    // If user is currently online, they cannot be "Inactive"
    if (isCurrentlyOnline) {
      // For online users, use higher threshold since they're actively playing
      const activeMinutes = Math.max(dailyMinutes, weeklyAvg);
      
      if (activeMinutes >= 120) return { 
        level: 'high', 
        label: 'Very Active', 
        color: 'text-green-400', 
        icon: '🔥',
        bgColor: 'bg-green-500'
      };
      if (activeMinutes >= 45) return { 
        level: 'medium', 
        label: 'Active', 
        color: 'text-yellow-400', 
        icon: '⚡',
        bgColor: 'bg-yellow-500'
      };
      // Even if low historical data, online users get "Active" minimum
      return { 
        level: 'active_online', 
        label: 'Active', 
        color: 'text-blue-400', 
        icon: '💧',
        bgColor: 'bg-blue-500'
      };
    }
    
    // For offline users, use historical data
    const activeMinutes = Math.max(dailyMinutes, weeklyAvg);
    
    if (activeMinutes >= 120) return { 
      level: 'high', 
      label: 'Very Active', 
      color: 'text-green-400', 
      icon: '🔥',
      bgColor: 'bg-green-500'
    };
    if (activeMinutes >= 45) return { 
      level: 'medium', 
      label: 'Active', 
      color: 'text-yellow-400', 
      icon: '⚡',
      bgColor: 'bg-yellow-500'
    };
    if (activeMinutes >= 10) return { 
      level: 'low', 
      label: 'Light Activity', 
      color: 'text-blue-400', 
      icon: '💧',
      bgColor: 'bg-blue-500'
    };
    return { 
      level: 'inactive', 
      label: 'Inactive', 
      color: 'text-gray-400', 
      icon: '😴',
      bgColor: 'bg-gray-400'
    };
  };

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

  const activityLevel = getActivityLevel(dailyMinutesToday, weeklyAverage, isCurrentlyOnline);
  const peakHours = formatPeakHours();

  // Compact version for player cards
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isCurrentlyOnline ? `${activityLevel.bgColor} animate-pulse` : 'bg-gray-400'}`} />
        <span className={activityLevel.color}>
          {activityLevel.label}
        </span>
        {activityTrend !== 'stable' && (
          <span className="text-xs text-gray-500">
            {activityTrend === 'increasing' ? '↗' : '↘'}
          </span>
        )}
        {!isCurrentlyOnline && lastOnlineTimestamp && (
          <span className="text-xs text-gray-500">• {formatLastSeen(lastOnlineTimestamp)}</span>
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

      {/* Stats Grid - ALWAYS SHOW */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-gray-400 flex items-center gap-1">
            <Clock size={12} />
            Today
          </div>
          <div className="font-medium text-white text-lg">
            {formatDuration(dailyMinutesToday)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-gray-400">Daily Average</div>
          <div className="font-medium text-white text-lg">
            {formatDuration(weeklyAverage)}
          </div>
        </div>
      </div>

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

      {/* Last Seen - ONLY FOR OFFLINE USERS */}
      {!isCurrentlyOnline && lastOnlineTimestamp && (
        <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
          Last seen {formatLastSeen(lastOnlineTimestamp)}
        </div>
      )}
    </div>
  );
};

export default ActivityPulse; 