import React, { Fragment } from 'react';
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
import { getRankTierInfo, getLadderScore } from '../../utils/rankingSystem';

// Define rank zones and gradients (should match your system)
const RANK_ZONES = [
  { name: 'Bronze', min: 0, max: 399, color: '#CD7C32', gradient: ['#c77d36', '#80451f'] },
  { name: 'Silver', min: 400, max: 799, color: '#6B7280', gradient: ['#d1d5db', '#6b7280'] },
  { name: 'Gold', min: 800, max: 1199, color: '#F59E0B', gradient: ['#facc15', '#b45309'] },
  { name: 'Platinum', min: 1200, max: 1599, color: '#06B6D4', gradient: ['#67e8f9', '#0e7490'] },
  { name: 'Diamond', min: 1600, max: 1899, color: '#3B82F6', gradient: ['#60a5fa', '#1e3a8a'] },
  { name: 'Emerald', min: 1900, max: 1999, color: '#10B981', gradient: ['#34d399', '#059669'] },
  { name: 'Nightmare', min: 2000, max: 2900, color: '#8B5CF6', gradient: ['#c084fc', '#7e22ce'] },
];

function getZoneForRP(rp: number) {
  return RANK_ZONES.find(zone => rp >= zone.min && rp <= zone.max);
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getRankNameForRP = (rp: number) => getZoneForRP(rp)?.name || '';

// TODO: Replace calculated ranks with raw rank titles once DB is updated
const getDisplayRank = (entry: RPChangeEntry) => entry.new_rank_title || entry.new_calculated_rank || 'Unknown';

// Custom Y-axis ticks to show RP and rank names
const CustomYAxisTick = (props: any) => {
  const { x, y, payload } = props;
  // Use displayRank for label
  return (
    <g>
      <text x={x - 8} y={y + 4} textAnchor="end" fill="#9CA3AF" fontWeight={700} fontSize={13}>
        {payload.value}
        {payload.displayRank && (
          <tspan dx="6" fill="#9CA3AF" fontSize="10">{` (${payload.displayRank})`}</tspan>
        )}
      </text>
    </g>
  );
};

const PlayerHistoryChart: React.FC<{ data: RPChangeEntry[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // Prepare display data with displayRank and ladderScore
  const displayData = data.map(entry => ({
    ...entry,
    displayRank: getDisplayRank(entry),
    ladderScore: getLadderScore(getDisplayRank(entry), entry.new_rp)
  }));

  // Find promotions (where rank tier changes)
  const promotions = data.filter((e, i) => i > 0 && getZoneForRP(e.new_rp)?.name !== getZoneForRP(data[i-1].new_rp)?.name);

  // Find min/max ladderScore for Y axis
  const minLadder = Math.min(...displayData.map(e => e.ladderScore));
  const maxLadder = Math.max(...displayData.map(e => e.ladderScore));

  // Find all unique rank zones in the data
  const usedZones = RANK_ZONES.filter(zone => data.some(e => e.new_rp >= zone.min && e.new_rp <= zone.max));

  // Generate unique gradient IDs for SVG defs
  const gradientIds = usedZones.reduce((acc, zone) => {
    acc[zone.name] = `rank-gradient-${zone.name}`;
    return acc;
  }, {} as Record<string, string>);

  // Build segments for colored lines and dots (use ladderScore for Y)
  const segments: { data: typeof displayData; color: string }[] = [];
  let current: typeof displayData = [displayData[0]];
  let currentZone = getZoneForRP(data[0].new_rp);
  for (let i = 1; i < displayData.length; i++) {
    const zone = getZoneForRP(data[i].new_rp);
    if (zone?.name !== currentZone?.name) {
      segments.push({ data: current, color: currentZone?.color || '#60A5FA' });
      current = [displayData[i - 1], displayData[i]];
      currentZone = zone;
    } else {
      current.push(displayData[i]);
    }
  }
  if (current.length > 1) segments.push({ data: current, color: currentZone?.color || '#60A5FA' });

  return (
    <div className="w-full h-72 bg-gray-800 rounded-lg mt-2 relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={displayData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          {/* SVG Gradients for rank zones */}
          <defs>
            {usedZones.map(zone => (
              <linearGradient id={gradientIds[zone.name]} key={zone.name} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={zone.gradient[0]} />
                <stop offset="100%" stopColor={zone.gradient[1]} />
              </linearGradient>
            ))}
          </defs>
          {/* Background rank zones with gradients */}
          {usedZones.map(zone => (
            <ReferenceArea
              key={zone.name}
              y1={zone.min}
              y2={zone.max}
              stroke={zone.color}
              fill={`url(#${gradientIds[zone.name]})`}
              fillOpacity={0.18}
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
            dataKey="ladderScore"
            stroke="#9CA3AF"
            fontSize={12}
            domain={[minLadder - 20, maxLadder + 20]}
            tick={<CustomYAxisTick />}
            width={120}
          />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid #374151', color: '#fff' }}
            labelFormatter={formatDate}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                const entry = payload[0].payload;
                const dateLabel = typeof label === 'string' ? label : String(label);
                return (
                  <div style={{ background: '#1F2937', border: '1px solid #374151', color: '#fff', padding: 10, borderRadius: 8 }}>
                    <div><strong>{formatDate(dateLabel)}</strong></div>
                    <div>Rank: {entry.displayRank}</div>
                    <div>RP: {entry.new_rp}</div>
                  </div>
                );
              }
              return null;
            }}
          />
          {/* Render colored line segments and dots using ladderScore for Y */}
          {segments.map((seg, idx) => (
            <Fragment key={idx}>
              <Line
                type="monotone"
                dataKey="ladderScore"
                data={seg.data}
                stroke={seg.color}
                strokeWidth={3}
                dot={false}
                isAnimationActive={true}
              />
              {seg.data.map((pt, i) => (
                // Only render dot for first point or if not duplicate
                (i === 0 && idx === 0) || i > 0 ? (
                  <ReferenceDot
                    key={pt.change_timestamp + '-dot'}
                    x={pt.change_timestamp}
                    y={pt.ladderScore}
                    r={5}
                    fill={seg.color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ) : null
              ))}
            </Fragment>
          ))}
          {/* Promotion markers, color-coded by new rank */}
          {promotions.map((e, i) => {
            const zone = getZoneForRP(e.new_rp);
            const entry = displayData.find(d => d.change_timestamp === e.change_timestamp);
            return (
              <ReferenceDot
                key={e.change_timestamp + '-promo'}
                x={e.change_timestamp}
                y={entry ? entry.ladderScore : undefined}
                r={9}
                fill={zone?.gradient ? `url(#${gradientIds[zone.name]})` : zone?.color || '#F59E0B'}
                stroke="#fff"
                strokeWidth={3}
                label={{ value: `PROMO: ${zone?.name || ''}`, position: 'top', fill: zone?.color || '#F59E0B', fontSize: 12, fontWeight: 700 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
      <div className="absolute top-2 right-4 text-xs text-gray-500">{data.length} entries</div>
    </div>
  );
};

export default PlayerHistoryChart; 