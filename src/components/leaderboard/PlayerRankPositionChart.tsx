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
} from 'recharts';
import { startOfDay, formatISO } from 'date-fns';

// --- Dynamic density-based visual weighting utilities (copied from PlayerHistoryChart) ---
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

// Helper to get display rank (copied from PlayerHistoryChart)
function getDisplayRank(entry: RPChangeEntry) {
  return entry.new_rank_title || entry.new_calculated_rank || 'Unknown';
}

const PlayerRankPositionChart: React.FC<{ data: RPChangeEntry[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  // --- Dynamic segment calculation ---
  const segments = buildSegments(data);
  const chartData = mapDataToWeightedX(segments).map(d => ({
    ...d,
    rankPosition: d.new_rank,
    displayRank: getDisplayRank(d),
    timestamp: new Date(d.change_timestamp).getTime(),
  }));
  chartData.sort((a, b) => a.chartX - b.chartX);

  // Defensive check for allSameY: only true if at least two points
  const allSameY = chartData.length > 1 && chartData.every(pt => pt.rankPosition === chartData[0].rankPosition);

  // Calculate min/max for Y-axis with padding
  const minRank = Math.min(...chartData.map(e => e.rankPosition));
  const maxRank = Math.max(...chartData.map(e => e.rankPosition));
  const yPadding = Math.max(1, (maxRank - minRank) * 0.1);
  let yMin = minRank - yPadding;
  let yMax = maxRank + yPadding;
  if (yMin < 1) yMin = 1;

  // Custom X axis tick formatter for segment boundaries
  const segmentTicks = segments.map(s => s.chartStart).concat([1]);
  const formatSegmentTick = (x: number) => {
    const seg = segments.find(s => Math.abs(s.chartStart - x) < 0.001);
    return seg ? seg.date : '';
  };

  return (
    <div className="w-full h-72 bg-gray-800 rounded-lg mt-2 relative">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          {/* Gradient for rank position: bottom = deep red, top = UCLA Gold */}
          <defs>
            <linearGradient id="rankpos-gradient" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#7B1F1F" />
              <stop offset="100%" stopColor="#FFB401" />
            </linearGradient>
          </defs>
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
            dataKey="rankPosition"
            stroke="#9CA3AF"
            fontSize={12}
            domain={[1, 200]}
            allowDataOverflow={true}
            width={80}
            reversed // Lower rank is better (1 is top)
            ticks={[200, 150, 100, 50, 1]}
            tickFormatter={v => `#${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#1F2937', border: '1px solid #374151', color: '#fff' }}
            labelFormatter={(_, payload) => {
              if (!payload || !payload.length) return '';
              const entry = payload[0].payload;
              return new Date(entry.change_timestamp).toLocaleDateString();
            }}
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const entry = payload[0].payload;
                const dateLabel = new Date(entry.change_timestamp).toLocaleDateString();
                return (
                  <div style={{ background: '#1F2937', border: '1px solid #374151', color: '#fff', padding: 10, borderRadius: 8 }}>
                    <div><strong>{dateLabel}</strong></div>
                    <div>Rank Position: #{entry.rankPosition}</div>
                    <div>Rank: {entry.displayRank || '—'}</div>
                    <div>RP: {entry.new_rp}</div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="monotone"
            dataKey="rankPosition"
            stroke="url(#rankpos-gradient)"
            strokeWidth={3}
            dot={false}
            activeDot={false}
            isAnimationActive={!allSameY}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="absolute top-2 right-4 text-xs text-gray-500">{data.length} entries</div>
    </div>
  );
};

export default PlayerRankPositionChart; 