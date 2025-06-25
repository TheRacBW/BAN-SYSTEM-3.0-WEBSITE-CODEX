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
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const loadProfilePicture = async () => {
      if (profilePicture || isLoadingProfile || hasError) return;
      try {
        setIsLoadingProfile(true);
        const picture = await robloxApi.getProfilePictureByUsername(entry.username);
        setProfilePicture(picture);
      } catch {
        setHasError(true);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    loadProfilePicture();
  }, [entry.username, profilePicture, isLoadingProfile, hasError]);

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

  // Roblox profile URL
  const getRobloxProfileUrl = () => entry.user_id ? robloxApi.getRobloxProfileUrl(entry.user_id) : `https://www.roblox.com/user/${entry.username}/profile`;

  // Profile error fallback
  const handleProfileError = () => setProfilePicture('/default-avatar.png');

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
    // console.log(`${rankTitle}: ${colors.gradient}`);
    return colors;
  };

  const rankTier = entry.rank_title.toLowerCase().split(' ')[0];

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
          {isLoadingProfile ? (
            <div className="avatar-shimmer w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-shimmer" />
          ) : (
            <img
              src={profilePicture || '/default-avatar.png'}
              alt={`${entry.username}'s profile`}
              className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover transition-all duration-200 group-hover:shadow-lg group-hover:border-blue-400 group-hover:ring-2 group-hover:ring-blue-200"
              onError={handleProfileError}
              loading="lazy"
              style={{ boxShadow: entry.user_id ? '0 0 0 2px #3b82f6' : undefined }}
            />
          )}
          {/* Roblox logo overlay for verified users */}
          {entry.user_id && !isLoadingProfile && (
            <img src="/roblox-logo.svg" alt="Roblox" className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-white border border-gray-300 shadow" style={{ transform: 'translate(30%, 30%)' }} />
          )}
          <Tooltip id={`profile-tooltip-${entry.username}`} place="top" />
        </div>
        {/* Username and Rank */}
        <div className="flex flex-col min-w-0">
          <a
            href={getRobloxProfileUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate text-base"
            style={{ maxWidth: 120 }}
          >
            {entry.username}
          </a>
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