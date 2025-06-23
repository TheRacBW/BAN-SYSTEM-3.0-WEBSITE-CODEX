import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeaderboardEntry, calculateRankFromRP, getRankDisplayName, getRankTierIndex } from '../../types/leaderboard';
import { robloxApi } from '../../services/robloxApi';
import RankBadge from './RankBadge';

interface LeaderboardEntryProps {
  entry: LeaderboardEntry;
  index: number;
  previousEntry?: LeaderboardEntry;
  isAnimating?: boolean;
}

const LeaderboardEntryComponent: React.FC<LeaderboardEntryProps> = ({
  entry,
  index,
  previousEntry,
  isAnimating = false
}) => {
  // Calculate current and previous ranks
  const currentRank = calculateRankFromRP(entry.total_rp || entry.rp || 0);
  const previousRank = previousEntry ? calculateRankFromRP(previousEntry.total_rp || previousEntry.rp || 0) : null;
  
  // Calculate changes
  const rankPositionChange = previousEntry ? previousEntry.rank_position - entry.rank_position : 0;
  const rpChange = previousEntry ? (entry.total_rp || entry.rp || 0) - (previousEntry.total_rp || previousEntry.rp || 0) : 0;
  const rankTierChange = previousRank ? 
    getRankTierIndex(currentRank.rank_tier, currentRank.rank_number) - getRankTierIndex(previousRank.rank_tier, previousRank.rank_number) : 0;
  
  const isMovingUp = rankPositionChange > 0;
  const isMovingDown = rankPositionChange < 0;
  const hasGainedRP = rpChange > 0;
  const hasLostRP = rpChange < 0;
  const hasTierUp = rankTierChange > 0;
  const hasTierDown = rankTierChange < 0;

  const getPositionBadgeColor = (position: number) => {
    if (position <= 3) return 'bg-yellow-500 text-white';
    if (position <= 10) return 'bg-gray-500 text-white';
    if (position <= 50) return 'bg-orange-500 text-white';
    if (position <= 100) return 'bg-blue-500 text-white';
    return 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300';
  };

  const getPositionBadgeText = (position: number) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  };

  return (
    <div
      className={`
        relative flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
        hover:shadow-md dark:hover:shadow-gray-900/20 transition-all duration-300 group
        ${isAnimating && isMovingUp ? 'animate-slide-up bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : ''}
        ${isAnimating && isMovingDown ? 'animate-slide-down bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : ''}
        ${isAnimating && hasTierUp ? 'animate-glow-green ring-2 ring-green-200 dark:ring-green-700' : ''}
        ${isAnimating && hasTierDown ? 'animate-glow-red ring-2 ring-red-200 dark:ring-red-700' : ''}
        ${isAnimating && hasGainedRP ? 'ring-2 ring-green-200 dark:ring-green-700' : ''}
        ${isAnimating && hasLostRP ? 'ring-2 ring-red-200 dark:ring-red-700' : ''}
      `}
    >
      {/* Position Badge */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${getPositionBadgeColor(entry.rank_position)}`}>
        {getPositionBadgeText(entry.rank_position)}
      </div>

      {/* Profile Picture */}
      <div className="flex-shrink-0">
        {entry.profile_picture ? (
          <img
            src={entry.profile_picture}
            alt={`${entry.username}'s profile`}
            className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
            <span className="text-gray-500 dark:text-gray-400 text-lg font-bold">
              {entry.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Player Info */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/players?search=${encodeURIComponent(entry.username)}`}
            className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 truncate"
          >
            {entry.username}
          </Link>
          
          {/* Rank Change Indicators */}
          {isAnimating && (
            <div className="flex items-center gap-1">
              {/* Position Change */}
              {rankPositionChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  isMovingUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {isMovingUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {Math.abs(rankPositionChange)}
                </div>
              )}
              
              {/* Tier Change */}
              {rankTierChange !== 0 && (
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  hasTierUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {hasTierUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {getRankDisplayName(previousRank!.rank_tier, previousRank!.rank_number)} → {getRankDisplayName(currentRank.rank_tier, currentRank.rank_number)}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Rank Display */}
        <div className="flex items-center gap-2 mt-1">
          <RankBadge
            rankTier={currentRank.rank_tier}
            rankNumber={currentRank.rank_number}
            displayRp={currentRank.display_rp}
            totalRp={entry.total_rp || entry.rp || 0}
            size="sm"
            showProgress={false}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {getRankDisplayName(currentRank.rank_tier, currentRank.rank_number)}
          </span>
        </div>
      </div>

      {/* RP Points */}
      <div className="flex-shrink-0 text-right">
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {(entry.total_rp || entry.rp || 0).toLocaleString()}
        </div>
        
        {/* RP Change Indicator */}
        {isAnimating && rpChange !== 0 && (
          <div className={`text-xs font-medium ${
            hasGainedRP ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {hasGainedRP ? '+' : ''}{rpChange.toLocaleString()}
          </div>
        )}
        
        {/* Display RP within tier */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {currentRank.display_rp}/100 RP
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {entry.user_id && (
          <a
            href={robloxApi.getRobloxProfileUrl(entry.user_id)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title="View on Roblox"
          >
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      {/* Animation Glow Effect */}
      {isAnimating && (isMovingUp || isMovingDown || hasTierUp || hasTierDown) && (
        <div className={`absolute inset-0 rounded-lg pointer-events-none ${
          isMovingUp || hasTierUp ? 'bg-green-500/10' : 'bg-red-500/10'
        }`} />
      )}
    </div>
  );
};

export default LeaderboardEntryComponent; 