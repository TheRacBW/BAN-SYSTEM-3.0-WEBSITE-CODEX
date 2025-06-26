import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { LeaderboardStats } from '../../types/leaderboard';
import { robloxApi } from '../../services/robloxApi';
import { calculateRankFromRPCached, getRankDisplayName } from '../../utils/rankingSystem';
import RankBadge from './RankBadge';

interface StatsCardProps {
  stats: LeaderboardStats[];
  type: 'gainers' | 'losers';
  title: string;
  icon: React.ReactNode;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats, type, title, icon }) => {
  const isGainers = type === 'gainers';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${isGainers ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
          <div className={isGainers ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {icon}
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Last 2 days</p>
        </div>
      </div>

      <div className="space-y-3">
        {stats.map((stat, index) => {
          // Get calculated rank (use existing or calculate from raw RP)
          const calculatedRank = stat.calculatedRank || 
            (stat.total_rp !== undefined ? calculateRankFromRPCached(stat.total_rp) : null);

          // Color for the avatar border based on rank
          const borderColors = [
            'border-yellow-500', // 1st
            'border-gray-500',   // 2nd
            'border-orange-500', // 3rd
            'border-blue-500'    // others
          ];
          const borderColor = borderColors[index] || borderColors[3];

          return (
            <div
              key={stat.username}
              className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {/* Ranking Number (outside the circle) */}
              <div className="flex flex-col items-center justify-center min-w-[32px]">
                <span className="text-xl font-extrabold text-gray-700 dark:text-gray-200 drop-shadow-sm">{index + 1}</span>
              </div>

              {/* Profile Picture in colored circle */}
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-white border-4 ${borderColor} shadow-md`}>
                {stat.profile_picture ? (
                  <img
                    src={stat.profile_picture}
                    alt={`${stat.username}'s profile`}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400 text-sm font-bold">
                      {stat.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Player Info */}
              <div className="flex-grow min-w-0">
                <Link
                  to={`/players?search=${encodeURIComponent(stat.username)}`}
                  className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 truncate block"
                >
                  {stat.username}
                </Link>
                {/* Rank Display */}
                {calculatedRank && (
                  <div className="flex items-center gap-2 mt-1">
                    <RankBadge
                      rankTitle={getRankDisplayName(calculatedRank.tier, calculatedRank.level)}
                      rp={calculatedRank.totalRP}
                      size="small"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {getRankDisplayName(calculatedRank.tier, calculatedRank.level)}
                    </span>
                  </div>
                )}
              </div>

              {/* RP Change */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className={`flex items-center gap-1 text-sm font-bold ${
                  isGainers ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {isGainers ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {isGainers ? '+' : ''}{(isGainers ? stat.total_gain : stat.total_loss)?.toLocaleString()}
                </div>
              </div>

              {/* Roblox Link */}
              {stat.user_id && (
                <a
                  href={robloxApi.getRobloxProfileUrl(stat.user_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-1 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  title="View on Roblox"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          );
        })}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No {isGainers ? 'gainers' : 'losers'} found in the last 2 days</p>
        </div>
      )}
    </div>
  );
};

export default StatsCard; 