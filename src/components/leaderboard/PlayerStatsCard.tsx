import React from 'react';
import type { PlayerStats } from '../../types/leaderboard';

const PlayerStatsCard: React.FC<{ stats: PlayerStats | null }> = ({ stats }) => {
  if (!stats) return <div className="w-full bg-gray-800 rounded-lg p-4 mb-4 flex items-center justify-center text-gray-400">Loading stats...</div>;
  return (
    <div className="w-full bg-gray-800 rounded-lg p-4 mb-4 flex flex-wrap gap-4 justify-between text-white">
      <div><span className="font-bold">Games:</span> {stats.totalGames}</div>
      <div><span className="font-bold">Total RP Gained:</span> {stats.totalRPGained}</div>
      <div><span className="font-bold">Highest RP:</span> {stats.highestRP}</div>
      <div><span className="font-bold">Current Rank:</span> {stats.currentRank}</div>
      <div><span className="font-bold">Promotions:</span> {stats.promotions}</div>
      <div><span className="font-bold">Avg RP/Game:</span> {stats.avgRPPerGame.toFixed(2)}</div>
      <div><span className="font-bold">Win Rate:</span> {(stats.winRate * 100).toFixed(1)}%</div>
    </div>
  );
};

export default PlayerStatsCard; 