import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeaderboardEntryWithChanges } from '../../types/leaderboard';
import { robloxApi } from '../../services/robloxApi';
import { calculateRankFromRPCached, getRankDisplayName, isTierPromotion, isTierDemotion, getRankTierInfo } from '../../utils/rankingSystem';
import RankBadge from './RankBadge';
import { Tooltip } from 'react-tooltip';

interface LeaderboardEntryProps {
  entry: LeaderboardEntryWithChanges;
  index: number;
}

const LeaderboardEntryComponent: React.FC<LeaderboardEntryProps> = ({
  entry,
  index
}) => {
  const [profilePicture, setProfilePicture] = useState<string | null>(entry.profile_picture || null);
  const [userId, setUserId] = useState<number | null>(entry.user_id || null);

  // Update state when entry data changes (from batch loading)
  useEffect(() => {
    if (entry.user_id && entry.user_id !== userId) {
      console.log('[LeaderboardEntry] Updating userId for', entry.username, ':', entry.user_id);
      setUserId(entry.user_id);
    }
    if (entry.profile_picture && entry.profile_picture !== profilePicture) {
      console.log('[LeaderboardEntry] Updating profilePicture for', entry.username, ':', entry.profile_picture);
      setProfilePicture(entry.profile_picture);
    }
  }, [entry.user_id, entry.profile_picture, userId, profilePicture, entry.username]);

  // Use calculated rank for badge/progress/sorting only
  const calculatedRank = entry.calculatedRank || calculateRankFromRPCached(entry.rp || 0);
  const rankInfo = calculatedRank ? getRankTierInfo(calculatedRank.tier) : null;

  // Progress bar logic
  const isNightmare = entry.rank_title?.toLowerCase().includes('nightmare');
  const progressMax = isNightmare ? 900 : 99;
  const progressValue = isNightmare ? entry.rp : calculatedRank.displayRP;
  const progressPercent = Math.min((progressValue / progressMax) * 100, 100);

  // Format RP
  const formatRP = (rp: number) => rp.toLocaleString();

  // Roblox profile URL - only return valid URL if we have user ID
  const getRobloxProfileUrl = () => {
    if (userId) {
      return `https://www.roblox.com/users/${userId}/profile`;
    }
    return null; // Return null if no user ID available
  };

  const profileUrl = getRobloxProfileUrl();
  const canOpenProfile = !!profileUrl;

  // Profile error fallback
  const handleProfileError = () => {
    setProfilePicture('/default-avatar.svg');
  };

  // Animation classes
  let animationClass = '';
  if (entry.has_changes) {
    if (entry.position_change > 0) animationClass = 'entry-position-improved';
    else if (entry.position_change < 0) animationClass = 'entry-position-declined';
  }

  // RP Bar color logic
  const getRPBarColors = (rankTitle: string) => {
    const tier = rankTitle.toUpperCase().split(' ')[0];
    const colorMappings: Record<string, { gradient: string; background: string; glow: string }> = {
      'NIGHTMARE': {
        gradient: 'linear-gradient(90deg, #9C27B0 0%, #E91E63 50%, #673AB7 100%)',
        background: 'rgba(156, 39, 176, 0.1)',
        glow: '0 0 15px rgba(156, 39, 176, 0.6)'
      },
      'EMERALD': {
        gradient: 'linear-gradient(90deg, #4CAF50 0%, #8BC34A 50%, #2E7D32 100%)',
        background: 'rgba(76, 175, 80, 0.1)',
        glow: '0 0 15px rgba(76, 175, 80, 0.6)'
      },
      'DIAMOND': {
        gradient: 'linear-gradient(90deg, #2196F3 0%, #03DAC6 50%, #1976D2 100%)',
        background: 'rgba(33, 150, 243, 0.1)',
        glow: '0 0 15px rgba(33, 150, 243, 0.6)'
      },
      'PLATINUM': {
        gradient: 'linear-gradient(90deg, #00BCD4 0%, #4DD0E1 50%, #0097A7 100%)',
        background: 'rgba(0, 188, 212, 0.1)',
        glow: '0 0 15px rgba(0, 188, 212, 0.6)'
      },
      'GOLD': {
        gradient: 'linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FF8F00 100%)',
        background: 'rgba(255, 215, 0, 0.1)',
        glow: '0 0 15px rgba(255, 215, 0, 0.6)'
      },
      'SILVER': {
        gradient: 'linear-gradient(90deg, #C0C0C0 0%, #E8E8E8 50%, #9E9E9E 100%)',
        background: 'rgba(192, 192, 192, 0.1)',
        glow: '0 0 15px rgba(192, 192, 192, 0.6)'
      },
      'BRONZE': {
        gradient: 'linear-gradient(90deg, #CD7F32 0%, #FF6B35 50%, #BF360C 100%)',
        background: 'rgba(205, 127, 50, 0.1)',
        glow: '0 0 15px rgba(205, 127, 50, 0.6)'
      }
    };
    const colors = colorMappings[tier] || colorMappings['BRONZE'];
    return colors;
  };

  const rankTier = entry.rank_title.toLowerCase().split(' ')[0];

  // Debug log for render
  console.log('[LeaderboardEntry] Render', entry.username, 'img src:', profilePicture, 'userId:', userId);

  return (
    <div className={`leaderboard-entry relative flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-300 ease-in-out rounded-xl shadow-sm hover:shadow-lg fade-in-row ${animationClass}`}
      style={{ minHeight: 72 }}
      data-rank={rankTier}>
      {/* Position */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-base bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 shadow-sm">{entry.rank_position}</div>
        {/* Profile Picture */}
        <div className="relative group" tabIndex={0} aria-label={`Roblox profile for ${entry.username}`}
          data-tooltip-id={`profile-tooltip-${entry.username}`}
          data-tooltip-content={`@${entry.username} \n View Roblox Profile`}>
          {profilePicture ? (
            <img
              src={profilePicture}
              alt={`${entry.username}'s profile`}
              className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover transition-all duration-200 group-hover:shadow-lg group-hover:border-blue-400 group-hover:ring-2 group-hover:ring-blue-200"
              onError={handleProfileError}
              loading="lazy"
              style={{ boxShadow: userId ? '0 0 0 2px #3b82f6' : undefined }}
            />
          ) : (
            <div className="avatar-shimmer w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-shimmer" />
          )}
          {/* Roblox logo overlay for verified users */}
          {userId && (
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white border border-gray-300 shadow flex items-center justify-center" style={{ transform: 'translate(30%, 30%)' }}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          )}
          <Tooltip id={`profile-tooltip-${entry.username}`} place="top" />
        </div>
        {/* Username and Rank */}
        <div className="flex flex-col min-w-0">
          {canOpenProfile ? (
            <a
              href={profileUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate text-base flex items-center gap-1 group"
              style={{ maxWidth: 120 }}
              title={`View ${entry.username}'s Roblox profile`}
            >
              {entry.username}
              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <span
              className="font-semibold text-gray-900 dark:text-white truncate text-base flex items-center gap-1"
              style={{ maxWidth: 120 }}
              title="Profile not available"
            >
              {entry.username}
            </span>
          )}
          <div className="flex items-center space-x-2 mt-0.5">
            <RankBadge rankTitle={entry.rank_title} rp={entry.rp} size="small" />
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{entry.rank_title}</span>
          </div>
        </div>
      </div>
      {/* RP and Progress */}
      <div className="flex items-center space-x-4 min-w-0">
        <div className="text-right min-w-[60px]">
          <div className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{formatRP(entry.rp)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total RP</div>
        </div>
        {/* Progress Bar */}
        <div className="w-28">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{progressValue}</span>
            <span>{progressMax}</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 border border-gray-300 dark:border-gray-600 relative overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                background: getRPBarColors(entry.rank_title).gradient,
                boxShadow: getRPBarColors(entry.rank_title).glow
              }}
            />
          </div>
        </div>
      </div>
      {/* RP Change Indicator */}
      {entry.rp_change !== 0 && (
        <div className={`rp-change absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold ${entry.rp_change > 0 ? 'gain' : 'loss'}`}
          style={{ boxShadow: '0 2px 8px rgba(34,197,94,0.08)' }}>
          {entry.rp_change > 0 ? '+' : ''}{entry.rp_change} RP
          {entry.position_change !== 0 && (
            <span className="position-change ml-1">
              ({entry.position_change > 0 ? '↑' : '↓'}{Math.abs(entry.position_change)})
            </span>
          )}
        </div>
      )}
      {/* Rank Title Change Indicator */}
      {entry.rank_title_change && (
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {entry.rank_title_change}
        </div>
      )}
    </div>
  );
};

export default LeaderboardEntryComponent; 