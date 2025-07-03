import React from 'react';
import type { PlayerHistoryModalProps } from '../../types/leaderboard';

const PlayerHistoryModal: React.FC<PlayerHistoryModalProps> = ({ username, isVisible, onClose }) => {
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">×</button>
        <h2 className="text-xl font-bold mb-4 text-white">{username}'s RP History</h2>
        {/* Chart and stats will go here */}
        <div className="h-64 flex items-center justify-center text-gray-400">[PlayerHistoryChart and PlayerStatsCard go here]</div>
      </div>
    </div>
  );
};

export default PlayerHistoryModal; 