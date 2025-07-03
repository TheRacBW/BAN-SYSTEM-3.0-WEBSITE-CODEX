import React from 'react';
import type { PlayerHistoryModalProps } from '../../types/leaderboard';
import { usePlayerHistory } from '../../hooks/usePlayerHistory';
import PlayerStatsCard from './PlayerStatsCard';
import PlayerHistoryChart from './PlayerHistoryChart';
import * as FaIcons from 'react-icons/fa';

const PlayerHistoryModal: React.FC<PlayerHistoryModalProps> = ({ username, isVisible, onClose }) => {
  const { data, stats, loading, error } = usePlayerHistory(username, isVisible);

  if (!isVisible) return null;

  // Calculate info for the modern info box
  let totalRPGained = 0, highestRP = 0, highestRank = '', currentRank = '', promotions = 0, joinedDate = '';
  if (data && data.length > 0) {
    totalRPGained = (data[data.length - 1]?.new_rp ?? 0) - (data[0]?.previous_rp ?? 0);
    const highestEntry = data.reduce((max, entry) => (entry.new_rp > max.new_rp ? entry : max), data[0]);
    highestRP = highestEntry?.new_rp ?? 0;
    highestRank = highestEntry?.new_calculated_rank ?? '';
    currentRank = data[data.length - 1]?.new_calculated_rank ?? '';
    promotions = data.filter((e, i) => i > 0 && e.new_calculated_rank !== data[i-1].new_calculated_rank).length;
    joinedDate = data[0]?.change_timestamp ? new Date(data[0].change_timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  }

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
            {/* Modern info box */}
            <div className="flex flex-wrap gap-4 items-center justify-start bg-gray-800 rounded-lg px-6 py-4 mb-2 shadow">
              <div className="flex items-center gap-2 text-yellow-400 text-base font-semibold">
                <span className="inline-block"><FaIcons.FaTrophy /></span>
                <span>Total RP Gained:</span>
                <span className="font-bold text-white">{totalRPGained}</span>
              </div>
              <div className="flex items-center gap-2 text-blue-400 text-base font-semibold">
                <span className="inline-block"><FaIcons.FaCrown /></span>
                <span>Highest RP:</span>
                <span className="font-bold text-white">{highestRP}</span>
                <span className="ml-2 text-xs text-blue-300">({highestRank})</span>
              </div>
              <div className="flex items-center gap-2 text-purple-400 text-base font-semibold">
                <span className="inline-block"><FaIcons.FaCrown /></span>
                <span>Current Rank:</span>
                <span className="font-bold text-white">{currentRank}</span>
              </div>
              <div className="flex items-center gap-2 text-green-400 text-base font-semibold">
                <span className="inline-block"><FaIcons.FaArrowUp /></span>
                <span>Promotions:</span>
                <span className="font-bold text-white">{promotions}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300 text-base font-semibold">
                <span className="inline-block"><FaIcons.FaCalendarAlt /></span>
                <span>Joined Leaderboard:</span>
                <span className="font-bold text-white">{joinedDate}</span>
              </div>
            </div>
            <PlayerHistoryChart data={data} />
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerHistoryModal; 