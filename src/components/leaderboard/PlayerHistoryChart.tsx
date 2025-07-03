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
import * as FaIcons from 'react-icons/fa';

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

// Define rank positions for Y-axis ticks
const RANK_Y_POSITIONS = [
  { value: 20700, label: 'NIGHTMARE' },
  { value: 20600, label: 'EMERALD' },
  { value: 20503, label: 'DIAMOND 3' },
  { value: 20502, label: 'DIAMOND 2' },
  { value: 20501, label: 'DIAMOND 1' },
  { value: 20404, label: 'PLATINUM 4' },
  { value: 20403, label: 'PLATINUM 3' },
  { value: 20402, label: 'PLATINUM 2' },
  { value: 20401, label: 'PLATINUM 1' },
  { value: 20304, label: 'GOLD 4' },
  { value: 20303, label: 'GOLD 3' },
  { value: 20302, label: 'GOLD 2' },
  { value: 20301, label: 'GOLD 1' },
  { value: 20204, label: 'SILVER 4' },
  { value: 20203, label: 'SILVER 3' },
  { value: 20202, label: 'SILVER 2' },
  { value: 20201, label: 'SILVER 1' },
  { value: 20104, label: 'BRONZE 4' },
  { value: 20103, label: 'BRONZE 3' },
  { value: 20102, label: 'BRONZE 2' },
  { value: 20101, label: 'BRONZE 1' },
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

// Gradient definitions for rank label text (darker, more saturated)
const RANK_LABEL_GRADIENTS = {
  'NIGHTMARE': ['#9333ea', '#581c87'],
  'EMERALD': ['#10b981', '#065f46'],
  'DIAMOND': ['#3b82f6', '#1e40af'],
  'PLATINUM': ['#22d3ee', '#155e75'],
  'GOLD': ['#eab308', '#78350f'],
  'SILVER': ['#9ca3af', '#374151'],
  'BRONZE': ['#a45b25', '#5c2e10'],
};

// Enhanced custom Y-axis tick with gradient color
const CustomYAxisTick = (rankTicks: { value: number; label: string }[]) => ({ x, y, payload }: any) => {
  const rank = rankTicks.find(tick => Math.abs(tick.value - payload.value) < 10);
  // Always return an SVG element (empty <g /> if not found)
  if (!rank) return <g />;
  // Find the base rank for gradient (e.g., DIAMOND from DIAMOND 2)
  const base = Object.keys(RANK_LABEL_GRADIENTS).find(key => rank.label.toUpperCase().includes(key));
  const gradId = base ? `rank-label-gradient-${base}` : undefined;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fontSize="12"
        fontWeight="bold"
        fill={gradId ? `url(#${gradId})` : '#9CA3AF'}
      >
        {rank.label}
      </text>
    </g>
  );
};

// Helper to get color for a given rank name
const getRankColor = (rankName: string) => {
  const zone = RANK_ZONES.find(z => z.name.toLowerCase() === rankName.toLowerCase());
  return zone ? zone.color : '#60A5FA';
};

// Define a type for chart data points
type ChartDataPoint = {
  [key: string]: any;
  displayRank: string;
  ladderScore: number;
  change_timestamp: string;
};

const PlayerHistoryChart: React.FC<{ data: RPChangeEntry[]; stats?: any }> = ({ data, stats }) => {
  if (!data || data.length === 0) return null;

  // Calculate joined leaderboard date (first entry)
  const joinedDate = data[0]?.change_timestamp ? formatDate(data[0].change_timestamp) : '—';

  // Calculate highest RP and rank
  const highestEntry = data.reduce((max, entry) => (entry.new_rp > max.new_rp ? entry : max), data[0]);
  const highestRP = highestEntry?.new_rp ?? '—';
  const highestRank = highestEntry?.new_calculated_rank ?? '—';

  // Calculate current rank
  const currentEntry = data[data.length - 1];
  const currentRank = currentEntry?.new_calculated_rank ?? '—';

  // Calculate total RP gained
  const totalRPGained = (data[data.length - 1]?.new_rp ?? 0) - (data[0]?.previous_rp ?? 0);

  // Calculate promotions (number)
  const promotions = data.filter((e, i) => i > 0 && e.new_calculated_rank !== data[i-1].new_calculated_rank).length;
  // Promotion events (array) for chart markers
  const promotionEvents = data.filter((e, i) => i > 0 && e.new_calculated_rank !== data[i-1].new_calculated_rank);

  // Prepare chart data: add displayRank, ladderScore, and timestamp
  const chartData = data.map(entry => ({
    ...entry,
    displayRank: getDisplayRank(entry),
    ladderScore: getLadderScore(getDisplayRank(entry), entry.new_rp),
    timestamp: new Date(entry.change_timestamp).getTime(),
  }));
  // Sort by timestamp
  chartData.sort((a, b) => a.timestamp - b.timestamp);

  // Calculate min/max for Y-axis
  const minLadder = Math.min(...chartData.map(e => e.ladderScore));
  const maxLadder = Math.max(...chartData.map(e => e.ladderScore));
  let yMin = minLadder;
  let yMax = maxLadder;
  const minRange = Math.max(20, (maxLadder || 1) * 0.05);
  if (maxLadder - minLadder < minRange) {
    const mid = (maxLadder + minLadder) / 2;
    yMin = mid - minRange / 2;
    yMax = mid + minRange / 2;
  }

  // Find all unique rank zones in the data
  const usedZones = RANK_ZONES.filter(zone => data.some(e => e.new_rp >= zone.min && e.new_rp <= zone.max));
  const gradientIds = usedZones.reduce((acc, zone) => {
    acc[zone.name] = `rank-gradient-${zone.name}`;
    return acc;
  }, {} as Record<string, string>);

  // Build gradient stops for the line
  const getRankColor = (rankName: string) => {
    const zone = RANK_ZONES.find(z => z.name.toLowerCase() === rankName.toLowerCase());
    return zone ? zone.color : '#3B82F6';
  };
  const stops = chartData.map((pt, i) => {
    const offset = (i / (chartData.length - 1)) * 100;
    return { color: getRankColor(pt.displayRank), offset: `${offset}%` };
  });

  // Calculate rank positions from actual chart data
  const calculateRankPositions = (chartData: ChartDataPoint[]) => {
    const rankPositions = new Map<string, number>();
    chartData.forEach((entry: ChartDataPoint) => {
      const rank = entry.displayRank; // Use displayRank (calculated or raw)
      const totalRP = entry.ladderScore;
      if (!rankPositions.has(rank)) {
        rankPositions.set(rank, totalRP);
      }
    });
    return rankPositions;
  };

  const useRankBasedYAxis = (chartData: ChartDataPoint[]) => {
    const rankPositions = calculateRankPositions(chartData);
    // Convert to array and sort by ladderScore value
    const rankTicks = Array.from(rankPositions.entries())
      .map(([rank, value]) => ({ value, label: rank }))
      .sort((a, b) => a.value - b.value);
    return rankTicks;
  };

  const findRankTransitions = (chartData: ChartDataPoint[]) => {
    const transitions = [];
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];
      if (prev.displayRank !== curr.displayRank) {
        transitions.push({
          fromRank: prev.displayRank,
          toRank: curr.displayRank,
          fromTotalRP: prev.ladderScore,
          toTotalRP: curr.ladderScore,
          timestamp: curr.change_timestamp
        });
      }
    }
    return transitions;
  };

  // Calculate rank ticks and log debug info
  const rankTicks = useRankBasedYAxis(chartData);
  // Debug: log the values
  console.log('Rank Positions from Data:');
  rankTicks.forEach(tick => {
    console.log(`${tick.label}: ${tick.value}`);
  });
  const transitions = findRankTransitions(chartData);
  console.log('Rank Transitions:', transitions);

  // Custom tick formatter for Y-axis
  const formatYAxisTick = (value: number) => {
    const closestRank = rankTicks.find(tick => Math.abs(tick.value - value) < 10);
    return closestRank ? closestRank.label : '';
  };

  return (
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
      <div className="w-full h-72 bg-gray-800 rounded-lg mt-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            {/* SVG Gradients for rank zones and the line */}
            <defs>
              {usedZones.map(zone => (
                <linearGradient id={gradientIds[zone.name]} key={zone.name} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={zone.gradient[0]} />
                  <stop offset="100%" stopColor={zone.gradient[1]} />
                </linearGradient>
              ))}
              {/* Gradient for the line */}
              <linearGradient id="rank-gradient" x1="0" y1="0" x2="1" y2="0">
                {stops.map((stop, i) => (
                  <stop key={i} offset={stop.offset} stopColor={stop.color} />
                ))}
              </linearGradient>
              {/* Gradients for rank label text */}
              {Object.entries(RANK_LABEL_GRADIENTS).map(([key, [from, to]]) => (
                <linearGradient id={`rank-label-gradient-${key}`} key={key} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={from} />
                  <stop offset="100%" stopColor={to} />
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
              domain={[yMin, yMax]}
              allowDataOverflow={true}
              ticks={rankTicks.map(tick => tick.value)}
              tick={CustomYAxisTick(rankTicks)}
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
            {/* Single continuous line with smooth gradient */}
            <Line
              type="monotone"
              dataKey="ladderScore"
              stroke="url(#rank-gradient)"
              strokeWidth={3}
              dot={{ fill: '#3B82F6', r: 4, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={true}
            />
            {/* Promotion markers, color-coded by new rank */}
            {promotionEvents.map((e, i) => {
              const zone = getZoneForRP(e.new_rp);
              const entry = chartData.find(d => d.change_timestamp === e.change_timestamp);
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
    </>
  );
};

export default PlayerHistoryChart; 