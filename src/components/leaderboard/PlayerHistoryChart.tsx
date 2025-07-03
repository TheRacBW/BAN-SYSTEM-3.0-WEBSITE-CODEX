import React from 'react';
import type { RPChangeEntry } from '../../types/leaderboard';

const PlayerHistoryChart: React.FC<{ data: RPChangeEntry[] }> = ({ data }) => {
  return (
    <div className="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 mt-2">
      [Recharts RP progression chart will go here]
      <div className="absolute top-2 right-4 text-xs text-gray-500">{data.length} entries</div>
    </div>
  );
};

export default PlayerHistoryChart; 