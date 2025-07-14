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
import { startOfDay, formatISO } from 'date-fns';

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

// Map rank names to their main color (use your gradient's first color for each)
const FLAT_LINE_COLORS: Record<string, string> = {
  NIGHTMARE: "#8B5CF6", // purple
  EMERALD: "#10B981",   // green
  DIAMOND: "#3B82F6",   // blue
  PLATINUM: "#06B6D4",  // cyan
  GOLD: "#F59E0B",      // gold
  SILVER: "#6B7280",    // gray
  BRONZE: "#CD7C32",    // bronze
};

// --- Dynamic density-based visual weighting utilities ---
interface DaySegment {
  date: string;
  points: RPChangeEntry[];
  dataPoints: number;
  visualWeight: number;
  chartStart: number;
  chartEnd: number;
  chartWidth: number;
}

function groupByDay(data: RPChangeEntry[]) {
  const groups: Record<string, RPChangeEntry[]> = {};
  data.forEach(d => {
    const day = formatISO(startOfDay(new Date(d.change_timestamp)), { representation: 'date' });
    if (!groups[day]) groups[day] = [];
    groups[day].push(d);
  });
  return Object.entries(groups).map(([date, points]) => ({ date, points }));
}
function calculateVisualWeight(dataPointsInDay: RPChangeEntry[]) {
  const BASE_WEIGHT = 1.0, MAX_POINTS_PER_DAY = 50, MIN_VISUAL_WEIGHT = 0.2;
  const normalizedDensity = Math.min(dataPointsInDay.length / MAX_POINTS_PER_DAY, 1.0);
  const visualWeight = BASE_WEIGHT - (normalizedDensity * 0.8);
  return Math.max(visualWeight, MIN_VISUAL_WEIGHT);
}
function buildSegments(data: RPChangeEntry[]): DaySegment[] {
  const dayGroups = groupByDay(data);
  const dayDensity = dayGroups.map(day => ({
    date: day.date,
    dataPoints: day.points.length,
    points: day.points,
    visualWeight: calculateVisualWeight(day.points)
  }));
  const totalWeight = dayDensity.reduce((sum, d) => sum + d.visualWeight, 0);
  let accWidth = 0;
  return dayDensity.map(day => {
    const width = day.visualWeight / totalWeight;
    const segment: DaySegment = {
      ...day,
      chartStart: accWidth,
      chartEnd: accWidth + width,
      chartWidth: width
    };
    accWidth += width;
    return segment;
  });
}
function mapDataToWeightedX(segments: DaySegment[]) {
  return segments.flatMap(segment => {
    const { points, chartStart, chartEnd } = segment;
    if (points.length === 1) {
      return [{ ...points[0], chartX: (chartStart + chartEnd) / 2, dataDensity: points.length }];
    }
    return points.map((pt, i) => ({
      ...pt,
      chartX: chartStart + (chartEnd - chartStart) * (i / (points.length - 1 || 1)),
      dataDensity: points.length
    }));
  });
}

const PlayerHistoryChart: React.FC<{ data: RPChangeEntry[]; stats?: any }> = ({ data, stats }) => {
  if (!data || data.length === 0) return null;

  // --- Dynamic segment calculation ---
  const segments = buildSegments(data);
  const chartData = mapDataToWeightedX(segments).map(d => ({
    ...d,
    displayRank: getDisplayRank(d),
    ladderScore: getLadderScore(getDisplayRank(d), d.new_rp),
  }));
  chartData.sort((a, b) => a.chartX - b.chartX);

  // Defensive check for allSameY: only true if at least two points
  const allSameY = chartData.length > 1 && chartData.every(pt => pt.ladderScore === chartData[0].ladderScore);

  // Calculate min/max for Y-axis with 10% padding to avoid cutoff from outliers
  const minLadder = Math.min(...chartData.map(e => e.ladderScore));
  const maxLadder = Math.max(...chartData.map(e => e.ladderScore));
  const yPadding = Math.max(10, (maxLadder - minLadder) * 0.1);
  let yMin = minLadder - yPadding;
  let yMax = maxLadder + yPadding;

  // Find all unique rank zones in the data
  const usedZones = RANK_ZONES.filter(zone => data.some(e => e.new_rp >= zone.min && e.new_rp <= zone.max));
  const gradientIds = usedZones.reduce((acc, zone) => {
    acc[zone.name] = `rank-gradient-${zone.name}`;
    return acc;
  }, {} as Record<string, string>);

  // Build gradient stops for the line based on weighted X and rank transitions
  const stops = [];
  let lastColor = null;
  for (const pt of chartData) {
    const color = getRankColor(pt.displayRank);
    const offset = `${(pt.chartX * 100).toFixed(2)}%`;
    if (color !== lastColor) {
      stops.push({ color, offset });
      lastColor = color;
    }
  }
  // Always add the last point
  if (stops.length === 0 || stops[stops.length - 1].offset !== '100.00%') {
    const lastPt = chartData[chartData.length - 1];
    stops.push({ color: getRankColor(lastPt.displayRank), offset: '100%' });
  }

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

  // Custom tick formatter for Y-axis
  const rankTicks = useRankBasedYAxis(chartData);
  const formatYAxisTick = (value: number) => {
    const closestRank = rankTicks.find(tick => Math.abs(tick.value - value) < 10);
    return closestRank ? closestRank.label : '';
  };

  // Custom X axis tick formatter for segment boundaries
  const segmentTicks = segments.map(s => s.chartStart).concat([1]);
  const formatSegmentTick = (x: number) => {
    const seg = segments.find(s => Math.abs(s.chartStart - x) < 0.001);
    return seg ? seg.date : '';
  };

  // Get the rank for the flat line (use displayRank of the first point)
  const flatLineRank = chartData[0]?.displayRank?.toUpperCase();
  const flatLineColor = FLAT_LINE_COLORS[flatLineRank] || "#3B82F6";

  return (
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
            {/* Gradient for the line: stops at rank transitions, weighted by chartX */}
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
            dataKey="chartX"
            type="number"
            domain={[0, 1]}
            ticks={segmentTicks}
            tickFormatter={formatSegmentTick}
            stroke="#9CA3AF"
            fontSize={12}
            minTickGap={20}
            allowDuplicatedCategory={false}
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
            labelFormatter={(_, payload) => {
              if (!payload || !payload.length) return '';
              const entry = payload[0].payload;
              // Use the original date, not chartX
              return formatDate(new Date(entry.change_timestamp).toISOString());
            }}
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const entry = payload[0].payload;
                const dateLabel = formatDate(new Date(entry.change_timestamp).toISOString());
                return (
                  <div style={{ background: '#1F2937', border: '1px solid #374151', color: '#fff', padding: 10, borderRadius: 8 }}>
                    <div><strong>{dateLabel}</strong></div>
                    <div>Rank: {entry.displayRank}</div>
                    <div>RP: {entry.new_rp}</div>
                  </div>
                );
              }
              return null;
            }}
          />
          {/* Single continuous line with smooth gradient, no visible data dots */}
          <Line
            type="monotone"
            dataKey="ladderScore"
            stroke={allSameY ? flatLineColor : "url(#rank-gradient)"}
            strokeWidth={3}
            dot={false} // Hide all data point indicators
            activeDot={false}
            isAnimationActive={!allSameY}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="absolute top-2 right-4 text-xs text-gray-500">{data.length} entries</div>
    </div>
  );
};

export default PlayerHistoryChart; 