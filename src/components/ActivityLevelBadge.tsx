import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getActivityLevel } from '../lib/activityPulseUtils';

interface ActivityLevelBadgeProps {
  dailyMinutes: number;
  weeklyAverage: number;
  isCurrentlyOnline?: boolean;
  activityTrend?: 'increasing' | 'decreasing' | 'stable';
  showTrend?: boolean;
  compact?: boolean;
  className?: string;
}

const ActivityLevelBadge: React.FC<ActivityLevelBadgeProps> = ({
  dailyMinutes,
  weeklyAverage,
  isCurrentlyOnline = false,
  activityTrend = 'stable',
  showTrend = true,
  compact = false,
  className = ''
}) => {
  const activityLevel = getActivityLevel(dailyMinutes, weeklyAverage, isCurrentlyOnline);
  
  // Generate CSS class based on activity level and online status
  const getActivityCssClass = () => {
    const baseClass = 'activity-badge-hover';
    
    // Special handling for specific levels
    if (activityLevel.level === 'very_high') {
      return `${baseClass} activity-hardcore-${isCurrentlyOnline ? 'online' : 'offline'}`;
    } else if (activityLevel.level === 'high') {
      return `${baseClass} activity-high-${isCurrentlyOnline ? 'online' : 'offline'}`;
    } else if (activityLevel.level === 'medium') {
      return `${baseClass} activity-medium-${isCurrentlyOnline ? 'online' : 'offline'}`;
    } else if (activityLevel.level === 'low' || activityLevel.level === 'active_online') {
      return `${baseClass} activity-low-${isCurrentlyOnline ? 'online' : 'offline'}`;
    } else {
      return `${baseClass} activity-inactive`;
    }
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <div className={`
          inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
          ${getActivityCssClass()}
          backdrop-blur-sm shadow-sm
        `}>
          <span>{activityLevel.icon}</span>
          <span>{activityLevel.label}</span>
        </div>
        
        {showTrend && activityTrend !== 'stable' && (
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
      </div>
    );
  }

  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-2 rounded-lg
      ${getActivityCssClass()}
      backdrop-blur-sm shadow-lg
      ${className}
    `}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{activityLevel.icon}</span>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{activityLevel.label}</span>
          {activityLevel.description && (
            <span className="text-xs opacity-80">{activityLevel.description}</span>
          )}
        </div>
      </div>
      
      {showTrend && activityTrend !== 'stable' && (
        <div className="flex items-center gap-1 ml-auto">
          {activityTrend === 'increasing' ? (
            <TrendingUp size={16} className="text-green-300" />
          ) : (
            <TrendingDown size={16} className="text-red-300" />
          )}
          <span className="text-xs">
            {activityTrend === 'increasing' ? 'Rising' : 'Declining'}
          </span>
        </div>
      )}
      
      {isCurrentlyOnline && (
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Online Now</span>
        </div>
      )}
    </div>
  );
};

export default ActivityLevelBadge;