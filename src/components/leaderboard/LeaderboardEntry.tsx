import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeaderboardEntryWithChanges } from '../../types/leaderboard';
import { robloxApi } from '../../services/robloxApi';
import { calculateRankFromRPCached, getRankDisplayName, isTierPromotion, isTierDemotion, getRankTierInfo } from '../../utils/rankingSystem';
import RankBadge from './RankBadge';

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

  return (
    <div className={`leaderboard-entry relative flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all duration-300 ease-in-out ${animationClass}`}>
      {/* Position */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">{entry.rank_position}</div>
        {/* Profile Picture */}
        <div className="relative">
          {isLoadingProfile ? (
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse" />
          ) : (
            <img
              src={profilePicture || '/default-avatar.png'}
              alt={`${entry.username}'s profile`}
              className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover"
              onError={handleProfileError}
              loading="lazy"
            />
          )}
        </div>
        {/* Username and Rank */}
        <div className="flex flex-col">
          <a
            href={getRobloxProfileUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {entry.username}
          </a>
          <div className="flex items-center space-x-2">
            <RankBadge rankTier={calculatedRank.tier} rankNumber={calculatedRank.level} displayRp={calculatedRank.displayRP} totalRp={calculatedRank.totalRP} size="sm" showProgress={false} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{entry.rank_title}</span>
          </div>
        </div>
      </div>
      {/* RP and Progress */}
      <div className="flex items-center space-x-4">
        <div className="text-right">
          <div className="font-bold text-lg text-gray-900 dark:text-white">{formatRP(entry.rp)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total RP</div>
        </div>
        {/* Progress Bar */}
        <div className="w-24">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{progressValue}</span>
            <span>{progressMax}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${rankInfo ? `bg-gradient-to-r ${rankInfo.gradient}` : 'bg-blue-500'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      {/* RP Change Indicator */}
      {entry.rp_change !== 0 && (
        <div className={`rp-change absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-semibold ${entry.rp_change > 0 ? 'gain' : 'loss'}`}>
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