import React from 'react';
import type { PlayerHistoryModalProps, RPChangeEntry } from '../../types/leaderboard';
import { usePlayerHistory } from '../../hooks/usePlayerHistory';
import PlayerStatsCard from './PlayerStatsCard';
import PlayerHistoryChart from './PlayerHistoryChart';
import { useState } from 'react';
import PlayerRankPositionChart from './PlayerRankPositionChart';
import * as FaIcons from 'react-icons/fa';

const PlayerHistoryModal: React.FC<PlayerHistoryModalProps> = ({ username, isVisible, onClose }) => {
  const { data, stats, loading, error } = usePlayerHistory(username, isVisible);

  const [activeTab, setActiveTab] = useState<'rp' | 'rank'>('rp');

  if (!isVisible) return null;

  // --- Advanced, hierarchy-aware RP calculation ---
  const RANK_ORDER = [
    'BRONZE 1', 'BRONZE 2', 'BRONZE 3', 'BRONZE 4',
    'SILVER 1', 'SILVER 2', 'SILVER 3', 'SILVER 4',
    'GOLD 1', 'GOLD 2', 'GOLD 3', 'GOLD 4',
    'PLATINUM 1', 'PLATINUM 2', 'PLATINUM 3', 'PLATINUM 4',
    'DIAMOND 1', 'DIAMOND 2', 'DIAMOND 3',
    'EMERALD', 'NIGHTMARE'
  ];
  function getRankIndex(rank: string) {
    return RANK_ORDER.findIndex(r => r.toUpperCase() === rank.toUpperCase());
  }
  function calculateTrueTotalRPGained(data: RPChangeEntry[]) {
    let total = 0;
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      const prevIdx = getRankIndex(prev.new_calculated_rank);
      const currIdx = getRankIndex(curr.new_calculated_rank);

      if (curr.new_calculated_rank === 'NIGHTMARE' && prev.new_calculated_rank === 'EMERALD') {
        // Only add (100 - Emerald RP) + Nightmare RP
        total += (100 - prev.new_rp) + curr.new_rp;
      } else if (currIdx > prevIdx) {
        // Promotion: sum carry-over for all crossed ranks
        let carry = 0;
        let rp = prev.new_rp;
        for (let j = prevIdx; j < currIdx; j++) {
          carry += 99 - rp;
          rp = 0;
        }
        carry += curr.new_rp;
        total += carry;
      } else if (currIdx < prevIdx) {
        // Demotion: sum loss for all crossed ranks
        let carry = 0;
        let rp = prev.new_rp;
        for (let j = prevIdx; j > currIdx; j--) {
          carry -= rp;
          rp = 99;
        }
        carry += curr.new_rp - 99;
        total += carry;
      } else {
        // Same rank
        total += curr.new_rp - prev.new_rp;
      }
    }
    return total;
  }

  // Calculate info for the modern info box
  let totalRPGained = 0, highestRP = 0, highestRank = '', currentRank = '', promotions = 0, joinedDate = '';
  if (data && data.length > 0) {
    totalRPGained = calculateTrueTotalRPGained(data);
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
            {/* Tab UI */}
            <div className="flex mb-4 gap-2">
              <button
                className={`px-4 py-2 rounded-t-lg font-semibold focus:outline-none transition-colors ${activeTab === 'rp' ? 'bg-gray-800 text-blue-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                onClick={() => setActiveTab('rp')}
              >
                RP History
              </button>
              <button
                className={`px-4 py-2 rounded-t-lg font-semibold focus:outline-none transition-colors ${activeTab === 'rank' ? 'bg-gray-800 text-blue-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                onClick={() => setActiveTab('rank')}
              >
                Rank Position
              </button>
            </div>
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
            {/* Tab content: show the selected graph */}
            {activeTab === 'rp' ? (
              <PlayerHistoryChart data={data} />
            ) : (
              <PlayerRankPositionChart data={data} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerHistoryModal; 