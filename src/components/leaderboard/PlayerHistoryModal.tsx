import React from 'react';
import type { PlayerHistoryModalProps } from '../../types/leaderboard';
import { usePlayerHistory } from '../../hooks/usePlayerHistory';
import PlayerStatsCard from './PlayerStatsCard';
import PlayerHistoryChart from './PlayerHistoryChart';

const PlayerHistoryModal: React.FC<PlayerHistoryModalProps> = ({ username, isVisible, onClose }) => {
  const { data, stats, loading, error } = usePlayerHistory(username, isVisible);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">×</button>
        <h2 className="text-xl font-bold mb-4 text-white">{username}'s RP History</h2>
        {loading && (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading history...</div>
        )}
        {error && (
          <div className="h-64 flex items-center justify-center text-red-400">{error}</div>
        )}
        {!loading && !error && data && data.length === 0 && (
          <div className="h-64 flex items-center justify-center text-gray-400">No history found for this player.</div>
        )}
        {!loading && !error && data && data.length > 0 && (
          <>
            <PlayerStatsCard stats={stats} />
            <PlayerHistoryChart data={data} />
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerHistoryModal; 