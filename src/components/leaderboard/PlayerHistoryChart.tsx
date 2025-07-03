import React from 'react';
import type { RPChangeEntry } from '../../types/leaderboard';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
  ReferenceDot,
} from 'recharts';
import { getRankTierInfo } from '../../utils/rankingSystem';

// Define rank zones and colors (should match your system)
const RANK_ZONES = [
  { name: 'Bronze', min: 0, max: 399, color: '#CD7C32' },
  { name: 'Silver', min: 400, max: 799, color: '#6B7280' },
  { name: 'Gold', min: 800, max: 1199, color: '#F59E0B' },
  { name: 'Platinum', min: 1200, max: 1599, color: '#06B6D4' },
  { name: 'Diamond', min: 1600, max: 1899, color: '#3B82F6' },
  { name: 'Emerald', min: 1900, max: 1999, color: '#10B981' },
  { name: 'Nightmare', min: 2000, max: 2900, color: '#8B5CF6' },
];

function getZoneForRP(rp: number) {
  return RANK_ZONES.find(zone => rp >= zone.min && rp <= zone.max);
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const PlayerHistoryChart: React.FC<{ data: RPChangeEntry[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Find promotions (where rank tier changes)
  const promotions = data.filter((e, i) => i > 0 && getZoneForRP(e.new_rp)?.name !== getZoneForRP(data[i-1].new_rp)?.name);

  // Find min/max RP for Y axis
  const minRP = Math.min(...data.map(e => e.new_rp));
  const maxRP = Math.max(...data.map(e => e.new_rp));

  // Find all unique rank zones in the data
  const usedZones = RANK_ZONES.filter(zone => data.some(e => e.new_rp >= zone.min && e.new_rp <= zone.max));

  return (
    <div className="w-full h-72 bg-gray-800 rounded-lg mt-2 relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          {/* Background rank zones */}
          {usedZones.map(zone => (
            <ReferenceArea
              key={zone.name}
              y1={zone.min}
              y2={zone.max}
              stroke={zone.color}
              fill={zone.color}
              fillOpacity={0.08}
              ifOverflow="extendDomain"
            />
          ))}
          <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
          <XAxis
            dataKey="change_timestamp"
            tickFormatter={formatDate}
            stroke="#9CA3AF"
            fontSize={12}
            minTickGap={20}
          />
          <YAxis
            dataKey="new_rp"
            stroke="#9CA3AF"
            fontSize={12}
            domain={[minRP - 20, maxRP + 20]}
          />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid #374151', color: '#fff' }}
            labelFormatter={formatDate}
            formatter={(value, name) => [value, name === 'new_rp' ? 'RP' : name]}
          />
          <Line
            type="monotone"
            dataKey="new_rp"
            stroke="#60A5FA"
            strokeWidth={2.5}
            dot={{ r: 3, stroke: '#fff', strokeWidth: 1 }}
            activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
            isAnimationActive={true}
          />
          {/* Promotion markers */}
          {promotions.map((e, i) => (
            <ReferenceDot
              key={e.change_timestamp + '-promo'}
              x={e.change_timestamp}
              y={e.new_rp}
              r={7}
              fill="#F59E0B"
              stroke="#fff"
              strokeWidth={2}
              label={{ value: 'PROMO', position: 'top', fill: '#F59E0B', fontSize: 10 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="absolute top-2 right-4 text-xs text-gray-500">{data.length} entries</div>
    </div>
  );
};

export default PlayerHistoryChart; 