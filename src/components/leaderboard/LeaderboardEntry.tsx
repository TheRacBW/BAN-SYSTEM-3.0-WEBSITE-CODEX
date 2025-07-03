import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeaderboardEntryWithChanges } from '../../types/leaderboard';
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
    if (entry.user_id) {
      return `https://www.roblox.com/users/${entry.user_id}/profile`;
    }
    return null; // Return null if no user ID available
  };

  const profileUrl = getRobloxProfileUrl();
  const canOpenProfile = !!profileUrl;

  // Profile error fallback
  const handleProfileError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = '/default-avatar.svg';
  };

  // Animation classes
  let animationClass = '';
  if (entry.has_changes) {
    if (entry.position_change > 0) animationClass = 'entry-position-improved';
    else if (entry.position_change < 0) animationClass = 'entry-position-declined';
  }

  // RP Bar color logic (updated gradients)
  const getRPBarColors = (rankTitle: string) => {
    const tier = rankTitle.toUpperCase().split(' ')[0];
    const colorMappings: Record<string, { gradient: string; background: string; glow: string }> = {
      'NIGHTMARE': {
        gradient: 'linear-gradient(90deg, #9333ea 0%, #581c87 100%)',
        background: 'rgba(147, 51, 234, 0.1)',
        glow: '0 0 15px rgba(147, 51, 234, 0.6)'
      },
      'EMERALD': {
        gradient: 'linear-gradient(90deg, #10b981 0%, #065f46 100%)',
        background: 'rgba(16, 185, 129, 0.1)',
        glow: '0 0 15px rgba(16, 185, 129, 0.6)'
      },
      'DIAMOND': {
        gradient: 'linear-gradient(90deg, #3b82f6 0%, #1e40af 100%)',
        background: 'rgba(59, 130, 246, 0.1)',
        glow: '0 0 15px rgba(59, 130, 246, 0.6)'
      },
      'PLATINUM': {
        gradient: 'linear-gradient(90deg, #22d3ee 0%, #155e75 100%)',
        background: 'rgba(34, 211, 238, 0.1)',
        glow: '0 0 15px rgba(34, 211, 238, 0.6)'
      },
      'GOLD': {
        gradient: 'linear-gradient(90deg, #eab308 0%, #78350f 100%)',
        background: 'rgba(234, 179, 8, 0.1)',
        glow: '0 0 15px rgba(234, 179, 8, 0.6)'
      },
      'SILVER': {
        gradient: 'linear-gradient(90deg, #9ca3af 0%, #374151 100%)',
        background: 'rgba(156, 163, 175, 0.1)',
        glow: '0 0 15px rgba(156, 163, 175, 0.6)'
      },
      'BRONZE': {
        gradient: 'linear-gradient(90deg, #a45b25 0%, #5c2e10 100%)',
        background: 'rgba(164, 91, 37, 0.1)',
        glow: '0 0 15px rgba(164, 91, 37, 0.6)'
      }
    };
    const colors = colorMappings[tier] || colorMappings['BRONZE'];
    return colors;
  };

  const rankTier = entry.rank_title.toLowerCase().split(' ')[0];

  // Rank icon URLs for each tier
  const rankIconUrls: Record<string, string> = {
    'BRONZE': 'https://static.wikia.nocookie.net/robloxbedwars/images/5/5a/Bronze_Rank_Icon.png',
    'SILVER': 'https://static.wikia.nocookie.net/robloxbedwars/images/6/64/Silver_Rank_Icon.png',
    'GOLD': 'https://static.wikia.nocookie.net/robloxbedwars/images/9/92/Gold_Rank_Icon.png',
    'PLATINUM': 'https://static.wikia.nocookie.net/robloxbedwars/images/0/08/Platinum_Rank_Icon.png',
    'DIAMOND': 'https://static.wikia.nocookie.net/robloxbedwars/images/c/cb/Diamond_Rank_Icon.png',
    'EMERALD': 'https://static.wikia.nocookie.net/robloxbedwars/images/0/06/Emerald_Rank_Icon.png',
    'NIGHTMARE': 'https://static.wikia.nocookie.net/robloxbedwars/images/7/76/Nightmare_Rank_Icon.png',
  };
  // Normalize the rank title to get the tier
  const normalizedTier = entry.rank_title ? entry.rank_title.split(' ')[0].toUpperCase() : '';
  const rankIconUrl = rankIconUrls[normalizedTier];

  // Debug log for render
  console.log('[LeaderboardEntry] Render', entry.username, 'img src:', entry.profile_picture, 'userId:', entry.user_id, 'profileUrl:', profileUrl);

  return (
    <div
      className={`leaderboard-entry flex items-center gap-6 p-4 bg-[#151e2e] rounded-2xl shadow-md mb-3 transition-all duration-300 group hover:shadow-xl border border-transparent hover:border-blue-500`}
      style={{ minHeight: 88 }}
      data-rank={rankTier}
    >
      {/* Position number and avatar, styled like the reference leaderboard */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Position number with outlined hexagon for #1, no border for #2/#3, number has gradient fill, hexagon on tip */}
        {index === 0 && (
          <span className="flex items-center justify-center w-10 h-10 select-none relative" style={{clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', border: '3px solid #FFD700', background: 'transparent', boxSizing: 'border-box'}}>
            <span className="relative inline-block">
              <span className="text-2xl font-extrabold bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 bg-clip-text text-transparent z-10 relative">1</span>
              <span className="absolute inset-0 pointer-events-none animate-gold-shine z-20"
                style={{
                  background: 'linear-gradient(120deg, transparent 40%, rgba(255, 215, 0, 0.25) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  mixBlendMode: 'lighten'
                }}
              />
            </span>
          </span>
        )}
        {index === 1 && (
          <span className="flex items-center justify-center w-10 h-10 select-none relative" style={{clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', background: 'transparent', boxSizing: 'border-box'}}>
            <span className="relative inline-block">
              <span className="text-2xl font-extrabold bg-gradient-to-br from-gray-200 via-gray-400 to-gray-500 bg-clip-text text-transparent z-10 relative">2</span>
              <span className="absolute inset-0 pointer-events-none animate-silver-shine z-20"
                style={{
                  background: 'linear-gradient(120deg, transparent 40%, rgba(160,160,160,0.18) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  mixBlendMode: 'lighten'
                }}
              />
            </span>
          </span>
        )}
        {index === 2 && (
          <span className="flex items-center justify-center w-10 h-10 select-none relative" style={{clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)', background: 'transparent', boxSizing: 'border-box'}}>
            <span className="relative inline-block">
              <span className="text-2xl font-extrabold bg-gradient-to-br from-[#a97142] via-[#8c6239] to-[#5c2e10] bg-clip-text text-transparent z-10 relative">3</span>
              <span className="absolute inset-0 pointer-events-none animate-bronze-shine z-20"
                style={{
                  background: 'linear-gradient(120deg, transparent 40%, rgba(234, 182, 118, 0.15) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  mixBlendMode: 'lighten'
                }}
              />
            </span>
          </span>
        )}
        {index > 2 && (
          <span className="flex items-center justify-center w-8 h-8 text-gray-400 font-bold text-lg select-none">
            {entry.rank_position}
          </span>
        )}
        {/* Profile picture */}
        {entry.profile_picture ? (
          <img
            src={entry.profile_picture}
            alt={`${entry.username}'s profile`}
            className="w-14 h-14 rounded-full object-cover bg-[#1e293b]"
            onError={handleProfileError}
            loading="lazy"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-700 animate-pulse" />
        )}
      </div>

      {/* Username, Rank Badge, and Roblox Link */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {canOpenProfile ? (
            <a
              href={profileUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold text-lg hover:text-blue-400 transition-colors flex items-center gap-1 truncate max-w-[160px]"
              title={`View ${entry.username}'s Roblox profile`}
            >
              {entry.username}
              <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <span className="text-white font-semibold text-lg truncate max-w-[160px]">{entry.username}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {/* Rank Badge (rounded rectangle, darker, more opaque, text 100% visible) */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl shadow relative"
            style={{
              background: getRPBarColors(entry.rank_title).gradient,
              boxShadow: getRPBarColors(entry.rank_title).glow,
            }}
          >
            {rankIconUrl && (
              <img src={rankIconUrl} alt={normalizedTier + ' rank icon'} className="w-[22px] h-[22px] object-contain mr-1" style={{display: 'inline-block', verticalAlign: 'middle'}} />
            )}
            <span className="text-white font-semibold text-sm drop-shadow">{entry.rank_title}</span>
            <span className="text-blue-200 text-xs font-bold ml-2">{entry.rp} RP</span>
          </div>
        </div>
      </div>

      {/* RP Change (pill) */}
      <div className="flex flex-col items-end min-w-[80px]">
        {entry.rp_change !== 0 && (
          <span
            className={`px-3 py-1 rounded-full font-bold text-xs mb-1 shadow-md ${entry.rp_change > 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
          >
            {entry.rp_change > 0 ? `+${entry.rp_change}` : entry.rp_change} RP
            {entry.position_change !== 0 && (
              <span className="ml-1">{entry.position_change > 0 ? '↑' : '↓'}{Math.abs(entry.position_change)}</span>
            )}
          </span>
        )}
        {/* Total RP */}
        <span className="text-white font-bold text-2xl leading-tight">{formatRP(entry.rp)}</span>
        <span className="text-gray-400 text-xs">Total RP</span>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col justify-center w-40 min-w-[140px] ml-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{progressValue}</span>
          <span>{progressMax}</span>
        </div>
        <div className="w-full h-2 bg-[#222c3c] rounded-full overflow-hidden relative">
          <div
            className="h-2 rounded-full animate-gradient-x transition-all duration-700"
            style={{
              width: `${progressPercent}%`,
              background: getRPBarColors(entry.rank_title).gradient,
              boxShadow: getRPBarColors(entry.rank_title).glow,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default LeaderboardEntryComponent; 