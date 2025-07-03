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

  // Debug log for render
  console.log('[LeaderboardEntry] Render', entry.username, 'img src:', entry.profile_picture, 'userId:', entry.user_id, 'profileUrl:', profileUrl);

  return (
    <div
      className={`leaderboard-entry flex items-center gap-6 p-4 bg-[#151e2e] rounded-2xl shadow-md mb-3 transition-all duration-300 group hover:shadow-xl border border-transparent hover:border-blue-500`}
      style={{ minHeight: 88 }}
      data-rank={rankTier}
    >
      {/* Avatar + Level Badge */}
      <div className="relative flex-shrink-0">
        {/* Crown for top 3 with pulse/glow and sparkle */}
        {index === 0 && (
          <span className="absolute -top-4 -left-2 flex items-center justify-center" title="Top 1">
            {/* Gold pulse */}
            <span className="absolute w-6 h-6 rounded-full animate-gold-pulse z-0" style={{boxShadow: '0 0 10px 4px #FFD70066'}}></span>
            <span className="relative z-10 text-2xl select-none" role="img" aria-label="Gold Crown">👑</span>
            {/* Sparkle */}
            <span className="absolute left-4 top-0 z-20 text-yellow-200 text-lg animate-sparkle select-none" role="img" aria-label="Sparkle">✨</span>
          </span>
        )}
        {index === 1 && (
          <span className="absolute -top-4 -left-2 flex items-center justify-center" title="Top 2">
            {/* Silver pulse */}
            <span className="absolute w-6 h-6 rounded-full animate-silver-pulse z-0" style={{boxShadow: '0 0 10px 4px #C0C0C066'}}></span>
            <span className="relative z-10 text-2xl select-none" role="img" aria-label="Silver Crown">🥈</span>
            {/* Sparkle */}
            <span className="absolute left-4 top-0 z-20 text-gray-200 text-lg animate-sparkle select-none" role="img" aria-label="Sparkle">✨</span>
          </span>
        )}
        {index === 2 && (
          <span className="absolute -top-4 -left-2 flex items-center justify-center" title="Top 3">
            {/* Bronze pulse */}
            <span className="absolute w-6 h-6 rounded-full animate-bronze-pulse z-0" style={{boxShadow: '0 0 10px 4px #a45b25AA'}}></span>
            <span className="relative z-10 text-2xl select-none" role="img" aria-label="Bronze Crown">🥉</span>
            {/* Sparkle */}
            <span className="absolute left-4 top-0 z-20 text-orange-200 text-lg animate-sparkle select-none" role="img" aria-label="Sparkle">✨</span>
          </span>
        )}
        {entry.profile_picture ? (
          <img
            src={entry.profile_picture}
            alt={`${entry.username}'s profile`}
            className="w-16 h-16 rounded-full border-2 border-[#222c3c] shadow-md object-cover bg-[#1e293b]"
            onError={handleProfileError}
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-700 animate-pulse" />
        )}
        {/* Level badge (rank position) - even smaller and farther right */}
        <span className="absolute -bottom-1 -right-2 bg-[#222c3c] text-white text-sm font-bold rounded-full px-1.5 py-0 border border-[#151e2e] shadow-md z-10">
          {entry.rank_position}
        </span>
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
            <span className="text-white font-semibold text-sm drop-shadow">{getRankDisplayName(calculatedRank.tier, calculatedRank.level)}</span>
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