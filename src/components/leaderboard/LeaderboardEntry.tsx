import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeaderboardEntry } from '../../types/leaderboard';
import { robloxApi } from '../../services/robloxApi';
import { calculateRankFromRPCached, getRankDisplayName, isTierPromotion, isTierDemotion, getRankTierInfo } from '../../utils/rankingSystem';
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
  const [profilePicture, setProfilePicture] = useState<string | null>(entry.profile_picture || null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Load profile picture if not available
  useEffect(() => {
    const loadProfilePicture = async () => {
      if (profilePicture || isLoadingProfile || hasError) return;

      try {
        setIsLoadingProfile(true);
        console.log(`Loading profile picture for ${entry.username}...`);
        
        const picture = await robloxApi.getProfilePictureByUsername(entry.username);
        setProfilePicture(picture);
        
        console.log(`Profile picture loaded for ${entry.username}:`, picture);
      } catch (error) {
        console.error(`Failed to load profile picture for ${entry.username}:`, error);
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

  // Get calculated rank (use existing or calculate from raw RP)
  const currentRank = entry.calculatedRank || calculateRankFromRPCached(entry.rp || 0);
  const previousRank = previousEntry?.calculatedRank || 
    (previousEntry ? calculateRankFromRPCached(previousEntry.rp || 0) : null);
  
  // Calculate changes
  const rankPositionChange = previousEntry ? previousEntry.rank_position - entry.rank_position : 0;
  const rpChange = previousEntry ? (entry.rp || 0) - (previousEntry.rp || 0) : 0;
  const rankTierChange = previousRank ? currentRank.tierIndex - previousRank.tierIndex : 0;
  
  const isMovingUp = rankPositionChange > 0;
  const isMovingDown = rankPositionChange < 0;
  const hasGainedRP = rpChange > 0;
  const hasLostRP = rpChange < 0;
  const hasTierUp = isTierPromotion(previousRank!, currentRank);
  const hasTierDown = isTierDemotion(previousRank!, currentRank);

  // Get rank information
  const displayRank = entry.calculatedRank?.calculatedRank || entry.rank_title || 'Unknown';

  // Format RP with commas
  const formatRP = (rp: number) => {
    return rp.toLocaleString();
  };

  // Get Roblox profile URL
  const getRobloxProfileUrl = () => {
    if (entry.user_id) {
      return robloxApi.getRobloxProfileUrl(entry.user_id);
    }
    return `https://www.roblox.com/user/${entry.username}/profile`;
  };

  // Handle profile picture error
  const handleProfileError = () => {
    console.warn(`Profile picture failed to load for ${entry.username}, using default`);
    setProfilePicture('/default-avatar.png');
    setHasError(true);
  };

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
        {isLoadingProfile ? (
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse" />
        ) : (
          <img
            src={profilePicture || '/default-avatar.png'}
            alt={`${entry.username}'s profile`}
            className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover"
            onError={handleProfileError}
            loading="lazy"
          />
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
                  {previousRank && `${getRankDisplayName(previousRank.tier, previousRank.level)} → ${getRankDisplayName(currentRank.tier, currentRank.level)}`}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Rank Display */}
        <div className="flex items-center gap-2 mt-1">
          <RankBadge
            rankTier={calculatedRank.tier}
            rankNumber={calculatedRank.level}
            displayRp={calculatedRank.displayRP}
            totalRp={calculatedRank.totalRP}
            size="sm"
            showProgress={false}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {entry.rank_title}
          </span>
        </div>
      </div>

      {/* RP Points */}
      <div className="flex-shrink-0 text-right">
        <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {formatRP(entry.rp)}
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
          {calculatedRank.displayRP}/100 RP
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {entry.user_id && (
          <a
            href={getRobloxProfileUrl()}
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