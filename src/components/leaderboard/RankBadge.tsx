import React from 'react';
import { RankTier, getRankTierInfo, getRankDisplayName, getProgressToNextTier } from '../../utils/rankingSystem';

interface RankBadgeProps {
  rankTier: RankTier;
  rankNumber: number;
  displayRp: number;
  totalRp: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const RankBadge: React.FC<RankBadgeProps> = ({
  rankTier,
  rankNumber,
  displayRp,
  totalRp,
  showProgress = false,
  size = 'md',
  className = ''
}) => {
  const rankInfo = getRankTierInfo(rankTier);
  const displayName = getRankDisplayName(rankTier, rankNumber);
  const progress = getProgressToNextTier(displayRp);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base'
  };

  return (
    <div className={`relative ${className}`}>
      {/* Main Rank Badge */}
      <div
        className={`
          ${sizeClasses[size]} 
          rounded-full flex items-center justify-center font-bold text-white
          bg-gradient-to-br ${rankInfo.gradient}
          shadow-lg ${rankInfo.glow}
          border-2 border-white dark:border-gray-800
          relative overflow-hidden
        `}
        style={{
          background: `linear-gradient(135deg, ${rankInfo.color}22, ${rankInfo.color}44)`,
          borderColor: rankInfo.color
        }}
      >
        {/* Rank Emoji */}
        <span className="text-center leading-none">
          {rankInfo.emoji}
        </span>
        
        {/* Progress Ring (for higher tiers) */}
        {showProgress && rankTier !== 'Nightmare' && (
          <svg
            className="absolute inset-0 w-full h-full transform -rotate-90"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="3"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="3"
              strokeDasharray={`${progress * 2.83} 283`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Rank Text (for larger sizes) */}
      {size === 'lg' && (
        <div className="mt-2 text-center">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {displayName}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {displayRp}/100 RP
          </div>
        </div>
      )}

      {/* Progress Bar (for medium and large sizes) */}
      {showProgress && size !== 'sm' && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>{displayRp} RP</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${rankInfo.color}, ${rankInfo.color}88)`
              }}
            />
          </div>
        </div>
      )}

      {/* Tooltip for small badges */}
      {size === 'sm' && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          {displayName} - {displayRp}/100 RP
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export default RankBadge; 