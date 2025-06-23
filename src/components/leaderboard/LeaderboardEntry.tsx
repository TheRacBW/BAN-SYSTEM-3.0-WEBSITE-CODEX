import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { LeaderboardEntry } from '../../types/leaderboard';
import { robloxApi } from '../../services/robloxApi';

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
  const rankChange = previousEntry ? previousEntry.rank_position - entry.rank_position : 0;
  const rpChange = previousEntry ? entry.rp - previousEntry.rp : 0;
  
  const isMovingUp = rankChange > 0;
  const isMovingDown = rankChange < 0;
  const hasGainedRP = rpChange > 0;
  const hasLostRP = rpChange < 0;

  const getRankBadgeColor = (rank: number) => {
    if (rank <= 3) return 'bg-yellow-500 text-white';
    if (rank <= 10) return 'bg-gray-500 text-white';
    if (rank <= 50) return 'bg-orange-500 text-white';
    if (rank <= 100) return 'bg-blue-500 text-white';
    return 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300';
  };

  const getRankBadgeText = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div
      className={`
        relative flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
        hover:shadow-md dark:hover:shadow-gray-900/20 transition-all duration-300
        ${isAnimating && isMovingUp ? 'animate-slide-up bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : ''}
        ${isAnimating && isMovingDown ? 'animate-slide-down bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' : ''}
        ${isAnimating && hasGainedRP ? 'ring-2 ring-green-200 dark:ring-green-700' : ''}
        ${isAnimating && hasLostRP ? 'ring-2 ring-red-200 dark:ring-red-700' : ''}
      `}
    >
      {/* Rank Badge */}
      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadgeColor(entry.rank_position)}`}>
        {getRankBadgeText(entry.rank_position)}
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
          
          {/* Rank Change Indicator */}
          {isAnimating && rankChange !== 0 && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              isMovingUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {isMovingUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(rankChange)}
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {entry.rank_title}
        </div>
      </div>

      {/* RP Points */}
      <div className="flex-shrink-0 text-right">
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {entry.rp.toLocaleString()}
        </div>
        
        {/* RP Change Indicator */}
        {isAnimating && rpChange !== 0 && (
          <div className={`text-xs font-medium ${
            hasGainedRP ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {hasGainedRP ? '+' : ''}{rpChange.toLocaleString()}
          </div>
        )}
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
      {isAnimating && (isMovingUp || isMovingDown) && (
        <div className={`absolute inset-0 rounded-lg pointer-events-none ${
          isMovingUp ? 'bg-green-500/10' : 'bg-red-500/10'
        }`} />
      )}
    </div>
  );
};

export default LeaderboardEntryComponent; 