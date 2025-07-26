import React, { useState, useEffect, useRef } from 'react';
import { Calculator, TrendingUp, TrendingDown, Target, Award, Shield, AlertCircle, AlertTriangle, BarChart3, Clock, BarChart2, BookOpen, Brain, HelpCircle, GripVertical, Save, Loader, History } from 'lucide-react';
import { ReferenceDot } from 'recharts';
import RankBadge from './leaderboard/RankBadge';
import { calculateRankFromRP, getRankDisplayName } from '../utils/rankingSystem';
import { useAuth } from '../context/AuthContext';
import { saveMMRSnapshot, processMatchHistory, getUserMatchStats } from '../services/mmrService';
import MMRHistoryTab from './mmr/MMRHistoryTab';
import AuthModal from './auth/AuthModal';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as RechartsTooltip, ReferenceArea, Area, Scatter, ComposedChart } from 'recharts';

// Rank system definitions based on your decompiled code
const RANK_DIVISIONS = {
  BRONZE_1: 0, BRONZE_2: 1, BRONZE_3: 2, BRONZE_4: 3,
  SILVER_1: 4, SILVER_2: 5, SILVER_3: 6, SILVER_4: 7,
  GOLD_1: 8, GOLD_2: 9, GOLD_3: 10, GOLD_4: 11,
  PLATINUM_1: 12, PLATINUM_2: 13, PLATINUM_3: 14, PLATINUM_4: 15,
  DIAMOND_1: 16, DIAMOND_2: 17, DIAMOND_3: 18,
  EMERALD_1: 19,
  NIGHTMARE_1: 20
};

const GLICKO_RATINGS = {
  [RANK_DIVISIONS.BRONZE_1]: 0,
  [RANK_DIVISIONS.BRONZE_2]: 500,
  [RANK_DIVISIONS.BRONZE_3]: 900,
  [RANK_DIVISIONS.BRONZE_4]: 1100,
  [RANK_DIVISIONS.SILVER_1]: 1400,
  [RANK_DIVISIONS.SILVER_2]: 1480,
  [RANK_DIVISIONS.SILVER_3]: 1550,
  [RANK_DIVISIONS.SILVER_4]: 1620,
  [RANK_DIVISIONS.GOLD_1]: 1700,
  [RANK_DIVISIONS.GOLD_2]: 1800,
  [RANK_DIVISIONS.GOLD_3]: 1880,
  [RANK_DIVISIONS.GOLD_4]: 1960,
  [RANK_DIVISIONS.PLATINUM_1]: 2020,
  [RANK_DIVISIONS.PLATINUM_2]: 2070,
  [RANK_DIVISIONS.PLATINUM_3]: 2100,
  [RANK_DIVISIONS.PLATINUM_4]: 2150,
  [RANK_DIVISIONS.DIAMOND_1]: 2170,
  [RANK_DIVISIONS.DIAMOND_2]: 2230,
  [RANK_DIVISIONS.DIAMOND_3]: 2300,
  [RANK_DIVISIONS.EMERALD_1]: 2370,
  [RANK_DIVISIONS.NIGHTMARE_1]: 2500
};

const RANK_NAMES = Object.keys(RANK_DIVISIONS);

// Rank colors for visualization
const RANK_COLORS = {
  'Bronze': '#CD7F32',
  'Silver': '#C0C0C0', 
  'Gold': '#FFD700',
  'Platinum': '#E5E4E2',
  'Diamond': '#B9F2FF',
  'Emerald': '#50C878',
  'Nightmare': '#FF6B6B'
};

// Shared function to calculate expected MMR for a given rank and RP (simple interpolation, no difficulty scaling)
const calculateExpectedMMR = (currentRank: string, currentRP: number): number => {
  const division = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
  const base = GLICKO_RATINGS[division];
  
  // Handle Nightmare rank edge case with realistic scaling
  if (currentRank === 'NIGHTMARE_1') {
    // Use logistic curve to simulate realistic flattening at high RP
    // This prevents the system from assuming infinite progression
    const base = 2500;
    const maxExtension = 2750; // Cap at 2750 instead of infinite
    const scale = 0.05; // Increased from 0.03 for earlier flattening
    const offset = -0.8; // Adjusted from -1.5 to start flattening around 50 RP
    
    // Logistic curve: grows quickly early, then levels off around 50-60 RP
    const growth = 1 / (1 + Math.exp(-scale * (currentRP + offset * 100)));
    const expectedMMR = Math.round(base + (maxExtension - base) * growth);
    
    // For extreme cases (RP > 100), use diminishing returns
    if (currentRP > 100) {
      const additionalRP = currentRP - 100;
      const diminishingFactor = Math.max(0.05, 1 - (additionalRP / 150)); // More aggressive diminishing returns
      const additionalMMR = (maxExtension - base) * 0.05 * diminishingFactor; // Reduced from 0.1
      return Math.round(expectedMMR + additionalMMR);
    }
    
    return expectedMMR;
  }
  
  // Normal calculation for all other ranks
  const nextDivision = Math.min(division + 1, RANK_NAMES.length - 1);
  const next = GLICKO_RATINGS[nextDivision];
  const rpProgress = Math.max(0, Math.min(1, currentRP / 100));
  return Math.round(base + (next - base) * rpProgress);
};

// Function to calculate dynamic threshold based on rank range (5% of rank range)
const getRankThreshold = (currentRank: string): number => {
  const division = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
  const base = GLICKO_RATINGS[division];
  
  // Handle Nightmare rank edge case
  if (currentRank === 'NIGHTMARE_1') {
    // For Nightmare, use a reasonable threshold based on the extension range
    const maxExtension = 500; // Same as in calculateExpectedMMR
    return Math.round(maxExtension * 0.05); // 5% of 500 = 25 points
  }
  
  // Normal calculation for all other ranks
  const next = GLICKO_RATINGS[division + 1] !== undefined ? GLICKO_RATINGS[division + 1] : base + 100;
  const rankRange = next - base;
  return Math.round(rankRange * 0.05); // 5% of rank range
};

// Function to compress Bronze tiers and Silver 1 by additional 20% while keeping values visible
const compressBronzeTiers = (mmr: number): number => {
  if (mmr <= 1400) {
    // Compress Bronze tiers (0-1100) and Silver 1 (1100-1400) by additional 20%
    // Original range: 0-1400 (1400 units)
    // First compression: 0-1100 becomes 0-770 (30% reduction)
    // Additional 20% compression: 0-770 becomes 0-616 (20% further reduction)
    if (mmr <= 1100) {
      return mmr * 0.7 * 0.8; // 30% + 20% = 44% total compression
    } else {
      // Silver 1: 1100-1400 compressed by 20%
      const bronzeCompressed = 1100 * 0.7 * 0.8; // 616
      const silver1Range = mmr - 1100; // 0-300
      const silver1Compressed = bronzeCompressed + (silver1Range * 0.8);
      return silver1Compressed;
    }
  } else {
    // For Silver 2+ tiers, adjust the scale to maintain proper positioning
    const bronzeAndSilver1Compressed = 1100 * 0.7 * 0.8 + 300 * 0.8; // 616 + 240 = 856
    const remainingRange = 2600 - 1400; // 1200
    const availableSpace = 2600 - bronzeAndSilver1Compressed; // 1744
    const scaleFactor = availableSpace / remainingRange; // 1744 / 1200 = 1.453
    
    return bronzeAndSilver1Compressed + (mmr - 1400) * scaleFactor;
  }
};

// Function to decompress for display purposes
const decompressForDisplay = (compressedMmr: number): number => {
  const bronzeCompressed = 1100 * 0.7 * 0.8; // 616
  const silver1Compressed = bronzeCompressed + 300 * 0.8; // 856
  
  if (compressedMmr <= bronzeCompressed) {
    // Decompress Bronze tiers
    return compressedMmr / (0.7 * 0.8);
  } else if (compressedMmr <= silver1Compressed) {
    // Decompress Silver 1
    const bronzeDecompressed = 1100;
    const silver1Range = (compressedMmr - bronzeCompressed) / 0.8;
    return bronzeDecompressed + silver1Range;
  } else {
    // Decompress Silver 2+ tiers
    const remainingRange = 2600 - 1400;
    const availableSpace = 2600 - silver1Compressed;
    const scaleFactor = availableSpace / remainingRange;
    
    return 1400 + (compressedMmr - silver1Compressed) / scaleFactor;
  }
};

interface MatchData {
  id: string;
  outcome: 'win' | 'loss' | 'draw';
  rpChange: number;
  wasShielded?: boolean;
}

interface PlayerData {
  currentRank: string;
  currentRP: number;
  totalWins: number;
  previousSeasonMMR?: number;
  isNewSeason: boolean;
  matchHistory: MatchData[];
  shieldGamesUsed?: number;
}

interface GlickoRating {
  rating: number;
  rd: number;
  vol: number;
}

// --- Advanced RP Prediction Section ---
const TABS = [
  { key: 'win', label: 'Win-based' },
  { key: 'loss', label: 'Loss-based' },
  { key: 'auto', label: 'Auto-calculate' },
];

const getAvgRP = (history: MatchData[], outcome: 'win' | 'loss') => {
  let filtered: MatchData[];
  
  if (outcome === 'loss') {
    // For losses, exclude shielded losses (0 RP loss) and only count actual RP losses
    filtered = history.filter(m => 
      m.outcome === 'loss' && m.rpChange < 0 && !m.wasShielded
    );
  } else {
    // For wins, include all wins
    filtered = history.filter(m => m.outcome === outcome);
  }
  
  if (filtered.length === 0) return '';
  
  // Apply recency weighting: more recent matches have higher weight
  const weightedSum = filtered.reduce((sum, match, index) => {
    const recencyWeight = Math.pow(0.9, index); // Recent matches get higher weight
    return sum + (match.rpChange * recencyWeight);
  }, 0);
  
  const totalWeight = filtered.reduce((sum, _, index) => {
    return sum + Math.pow(0.9, index);
  }, 0);
  
  return Math.round(weightedSum / totalWeight);
};

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group cursor-help">
      {children}
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-xs bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
        {text}
      </span>
    </span>
  );
}

// --- Glicko-2 Math for RP Prediction ---
function glickoExpectedScore(player: number, opponent: number) {
  // E = 1 / (1 + 10^((opponent - player)/400))
  return 1 / (1 + Math.pow(10, (opponent - player) / 400));
}

function estimateOpponentGlicko(playerGlicko: number, rpChange: number, outcome: 1 | 0, kFactor = 32) {
  // RP change = (ActualResult - ExpectedResult) * K
  // Rearranged: ExpectedResult = ActualResult - (RPchange / K)
  // E = 1 / (1 + 10^((opponent - player)/400))
  // Solve for opponent
  const expected = outcome - (rpChange / kFactor);
  if (expected <= 0 || expected >= 1) return null; // Out of bounds
  const odds = (1 / expected) - 1;
  const opponent = playerGlicko + 400 * Math.log10(odds);
  return Math.round(opponent);
}

function predictCounterRP(knownRP: number, knownOutcome: 1 | 0, playerGlicko: number, kFactor = 32) {
  // Estimate opponent rating
  const opponent = estimateOpponentGlicko(playerGlicko, knownRP, knownOutcome, kFactor);
  if (opponent === null) return null;
  // Predict RP for the opposite outcome
  const expected = glickoExpectedScore(playerGlicko, opponent);
  const counterRP = ((knownOutcome === 1 ? 0 : 1) - expected) * kFactor;
  return Math.round(counterRP);
}

function validateRPSymmetry(rpWin: number, rpLoss: number, playerGlicko: number, kFactor = 32) {
  // Predict loss from win and win from loss, check for symmetry
  const predLoss = predictCounterRP(rpWin, 1, playerGlicko, kFactor);
  const predWin = predictCounterRP(rpLoss, 0, playerGlicko, kFactor);
  let warning = '';
  if (predLoss !== null && Math.abs(predLoss - rpLoss) > 5) warning = 'Loss RP does not match Glicko-2 prediction.';
  if (predWin !== null && Math.abs(predWin - rpWin) > 5) warning = 'Win RP does not match Glicko-2 prediction.';
  return { predLoss, predWin, warning };
}

// --- Rank Difficulty Multipliers ---
const RANK_DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  'BRONZE': 1.35,   // Slightly higher new player boost
  'SILVER': 1.15,   // Keep as-is
  'GOLD': 1.0,      // Perfect baseline
  'PLATINUM': 0.85, // Gentle transition
  'DIAMOND': 0.7,   // Keep the difficulty spike
  'EMERALD': 0.55,  // Bridge to Nightmare
  'NIGHTMARE': 0.4  // Keep extreme difficulty
};

function getRankTier(rank: string) {
  if (rank.startsWith('BRONZE')) return 'BRONZE';
  if (rank.startsWith('SILVER')) return 'SILVER';
  if (rank.startsWith('GOLD')) return 'GOLD';
  if (rank.startsWith('PLATINUM')) return 'PLATINUM';
  if (rank.startsWith('DIAMOND')) return 'DIAMOND';
  if (rank.startsWith('EMERALD')) return 'EMERALD';
  if (rank.startsWith('NIGHTMARE')) return 'NIGHTMARE';
  return 'BRONZE';
}

function applyRankDifficultyScaling(rpChange: number, rank: string) {
  const multiplier = RANK_DIFFICULTY_MULTIPLIERS[getRankTier(rank)] || 1.0;
  return Math.round(rpChange * multiplier);
}

function adjustRPForRankChange(baseRP: number, playerGlicko: number, newRank: string, wasPromoted: boolean) {
  const newRankDivision = RANK_DIVISIONS[newRank as keyof typeof RANK_DIVISIONS];
  const newRankBaseline = GLICKO_RATINGS[newRankDivision];
  const skillGap = playerGlicko - newRankBaseline;
  if (wasPromoted) {
    const difficultyIncrease = Math.max(0.7, 1.0 - (skillGap / 300));
    return Math.round(baseRP * difficultyIncrease);
  } else if (wasPromoted === false) {
    const recoveryBonus = Math.min(1.3, 1.0 + Math.abs(skillGap) / 400);
    return Math.round(baseRP * recoveryBonus);
  }
  return baseRP;
}

// Info Tab Component
function GlickoGuide() {
  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Understanding Glicko Rating</h1>
        </div>
        <div className="prose max-w-none dark:prose-invert">
          {/* Section 1: What is Glicko Rating? */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              What is Glicko Rating?
            </h2>
            <div className="bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-400 dark:border-purple-600 p-4 mb-4">
              <p className="text-lg text-gray-700 dark:text-gray-200 leading-relaxed">
                <strong>Glicko Rating is your hidden "true skill" number</strong> that BedWars uses behind the scenes 
                to determine how much RP you gain or lose each match. Think of it as your actual skill level, 
                while RP is just what you see on your rank badge.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">🎮 What You See (RP System)</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                  <li>• "Silver 2, 45 RP"</li>
                  <li>• Resets to 0 when you rank up</li>
                  <li>• Goes from 0-99 in each rank</li>
                  <li>• Visible on your profile</li>
                </ul>
              </div>
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">🧠 Hidden System (Glicko)</h3>
                <ul className="text-sm text-green-700 dark:text-green-200 space-y-1">
                  <li>• Your actual skill rating (e.g., 1650)</li>
                  <li>• Never resets, always tracking</li>
                  <li>• Ranges from ~800 to 2500+</li>
                  <li>• Used for matchmaking & RP calculation</li>
                </ul>
              </div>
            </div>
          </section>
          {/* Section 2: The Three Numbers Explained */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Calculator className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              The Three Numbers That Control Your RP
            </h2>
            <div className="space-y-6">
              {/* MMR (Glicko) Rating */}
              <div className="border rounded-lg p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-blue-500 dark:bg-blue-700 rounded-full flex items-center justify-center text-white font-bold">1</div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">MMR (Your Skill Level)</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-200 mb-4">
                  This is your main skill number. Higher = more skilled player. The game compares your MMR 
                  to your opponents' to decide how much RP you should gain or lose.
                </p>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Skill Levels:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="font-medium">800-1200:</span> Learning</div>
                    <div><span className="font-medium">1200-1500:</span> Beginner</div>
                    <div><span className="font-medium">1500-1800:</span> Skilled</div>
                    <div><span className="font-medium">1800-2100:</span> Advanced</div>
                    <div><span className="font-medium">2100-2400:</span> Expert</div>
                    <div><span className="font-medium">2400+:</span> Elite</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Example:</strong> If you have 1650 MMR but you're only Silver 3, you're "underranked" 
                    and will gain more RP per win until you reach Gold/Platinum where you belong.
                  </p>
                </div>
              </div>
              {/* Rating Deviation */}
              <div className="border rounded-lg p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-green-500 dark:bg-green-700 rounded-full flex items-center justify-center text-white font-bold">2</div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">RD - Rating Deviation (Confidence)</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-200 mb-4">
                  This shows how "sure" the system is about your skill level. Lower RD = more confident in your rating.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 dark:bg-green-900/30 rounded p-3 text-center">
                    <div className="font-bold text-green-800 dark:text-green-200">RD: 0.8-1.2</div>
                    <div className="text-sm text-green-600 dark:text-green-300">Very Confident</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Stable RP changes</div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded p-3 text-center">
                    <div className="font-bold text-yellow-800 dark:text-yellow-200">RD: 1.2-2.0</div>
                    <div className="text-sm text-yellow-600 dark:text-yellow-300">Moderate Confidence</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Normal RP swings</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 rounded p-3 text-center">
                    <div className="font-bold text-red-800 dark:text-red-200">RD: 2.0+</div>
                    <div className="text-sm text-red-600 dark:text-red-300">Low Confidence</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Large RP changes</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>What this means:</strong> New players or those returning after a break have high RD, 
                    causing bigger RP swings. As you play more, RD decreases and RP changes become more predictable.
                  </p>
                </div>
              </div>
              {/* Volatility */}
              <div className="border rounded-lg p-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-orange-500 dark:bg-orange-700 rounded-full flex items-center justify-center text-white font-bold">3</div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Volatility (Consistency)</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-200 mb-4">
                  This measures how consistent your performance is. Do you play at the same level every game, 
                  or do you have "pop-off" games and "off" days?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded p-4">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Low Volatility (0.04-0.06)</h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-200 space-y-1">
                      <li>• Consistent performance</li>
                      <li>• Predictable RP changes</li>
                      <li>• Steady improvement</li>
                      <li>• More stable rating</li>
                    </ul>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded p-4">
                    <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">High Volatility (0.08+)</h4>
                    <ul className="text-sm text-orange-700 dark:text-orange-200 space-y-1">
                      <li>• Inconsistent performance</li>
                      <li>• Unpredictable RP swings</li>
                      <li>• Hot streaks and cold streaks</li>
                      <li>• Rating adjusts more quickly</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {/* Section 3: How It Affects Your RP */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              How MMR Determines Your RP Gains/Losses
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 mb-6">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">💡 The Key Formula</h3>
              <p className="text-yellow-700 dark:text-yellow-100">
                Your RP change = Base RP × (How surprising the result was) × (Rank difficulty) × (Confidence adjustments)
              </p>
            </div>
            <div className="space-y-4">
              <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">🎯 Scenario 1: You're Underranked</h3>
                <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded text-sm">
                  <p><strong>Situation:</strong> Your MMR (1750) is higher than your rank expects (Silver 3 ≈ 1550)</p>
                  <p><strong>Result:</strong> Higher RP gains (+18-22 per win) because you "should" be ranking up</p>
                  <p><strong>Why:</strong> The system wants to move you to your "correct" rank quickly</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">🎯 Scenario 2: You're Overranked</h3>
                <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded text-sm">
                  <p><strong>Situation:</strong> Your MMR (1400) is lower than your rank expects (Gold 2 ≈ 1800)</p>
                  <p><strong>Result:</strong> Lower RP gains (+8-12 per win) and higher losses (-15-20 per loss)</p>
                  <p><strong>Why:</strong> The system thinks you got "lucky" and wants to move you down</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">🎯 Scenario 3: You're Perfectly Ranked</h3>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded text-sm">
                  <p><strong>Situation:</strong> Your MMR matches your rank's expectation</p>
                  <p><strong>Result:</strong> Standard RP changes (+15 wins, -12 losses)</p>
                  <p><strong>Why:</strong> You're where you belong, so changes are predictable</p>
                </div>
              </div>
            </div>
          </section>
          {/* Section 4: Common Questions */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Common Questions
            </h2>
            <div className="space-y-4">
              <details className="border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <summary className="p-4 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">
                  Why do I gain different RP amounts each game?
                </summary>
                <div className="p-4 pt-0 text-gray-700 dark:text-gray-200">
                  Because your opponents have different MMRs! Beating a 2000-rated player gives more RP 
                  than beating a 1400-rated player. The system also considers how "expected" your win was.
                </div>
              </details>
              <details className="border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <summary className="p-4 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">
                  Why did my RP gains decrease after ranking up?
                </summary>
                <div className="p-4 pt-0 text-gray-700 dark:text-gray-200">
                  When you rank up, your expected skill level increases. If your MMR doesn't match the new rank's 
                  expectation, you'll gain less RP until your skill "catches up" to your new rank.
                </div>
              </details>
              <details className="border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <summary className="p-4 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">
                  Can I see my exact MMR in-game?
                </summary>
                <div className="p-4 pt-0 text-gray-700 dark:text-gray-200">
                  No, MMR is hidden. This calculator estimates your MMR based on your RP patterns, 
                  current rank, and match history. It's an educated guess, not the exact number.
                </div>
              </details>
              <details className="border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <summary className="p-4 cursor-pointer font-semibold hover:bg-gray-50 dark:hover:bg-gray-800">
                  Does MMR reset each season?
                </summary>
                <div className="p-4 pt-0 text-gray-700 dark:text-gray-200">
                  No! Your MMR carries over between seasons. However, your RD (confidence) might increase 
                  slightly due to the time gap, causing bigger RP swings in your first few games.
                </div>
              </details>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const BedWarsMMRCalculator = () => {
  const [playerData, setPlayerData] = useState<PlayerData>({
    currentRank: 'SILVER_2',
    currentRP: 45,
    totalWins: 23,
    previousSeasonMMR: undefined,
    isNewSeason: false,
    matchHistory: [],
    shieldGamesUsed: 0
  });

  const [calculatedMMR, setCalculatedMMR] = useState<GlickoRating | null>(null);
  const [projectedRP, setProjectedRP] = useState<number>(0);
  const [accuracyScore, setAccuracyScore] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [accuracyPercentage, setAccuracyPercentage] = useState<number>(0);
  const [demotionShieldActive, setDemotionShieldActive] = useState(false);
  const [shieldStatus, setShieldStatus] = useState<{ active: boolean; gamesUsed: number; warning: boolean }>({ 
    active: false, 
    gamesUsed: 0, 
    warning: false 
  });

  // --- MMR History System ---
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [userNotes, setUserNotes] = useState('');

  // --- Advanced RP Prediction Section ---
  const [predictionTab, setPredictionTab] = useState('win'); // Default to Win-based
  const [simGames, setSimGames] = useState(10); // Default to 10 games
  const [avgRPWin, setAvgRPWin] = useState<number>(0);
  const [avgRPLoss, setAvgRPLoss] = useState<number>(0);

  // Track next match ID for unique, ever-increasing IDs
  const [nextMatchId, setNextMatchId] = useState(() => {
    // Find the highest ID in the initial matchHistory
    const initial = [
      { id: '1', outcome: 'win', rpChange: 18 },
      { id: '2', outcome: 'win', rpChange: 15 },
      { id: '3', outcome: 'loss', rpChange: -12 },
      { id: '4', outcome: 'win', rpChange: 22 },
      { id: '5', outcome: 'loss', rpChange: -8 },
      { id: '6', outcome: 'draw', rpChange: 3 },
      { id: '7', outcome: 'win', rpChange: 16 },
      { id: '8', outcome: 'loss', rpChange: 0, wasShielded: true },
      { id: '9', outcome: 'win', rpChange: 19 },
      { id: '10', outcome: 'win', rpChange: 21 }
    ];
    const maxId = initial.reduce((max, m) => Math.max(max, parseInt(m.id, 10)), 0);
    return maxId + 1;
  });

  // Initialize with some sample match data including shield scenarios
  useEffect(() => {
    const sampleMatches: MatchData[] = [
      { id: '1', outcome: 'win', rpChange: 18 },
      { id: '2', outcome: 'win', rpChange: 15 },
      { id: '3', outcome: 'loss', rpChange: -12 },
      { id: '4', outcome: 'win', rpChange: 22 },
      { id: '5', outcome: 'loss', rpChange: -8 },
      { id: '6', outcome: 'draw', rpChange: 3 },
      { id: '7', outcome: 'win', rpChange: 16 },
      { id: '8', outcome: 'loss', rpChange: 0, wasShielded: true },
      { id: '9', outcome: 'win', rpChange: 19 },
      { id: '10', outcome: 'win', rpChange: 21 }
    ];
    
    setPlayerData(prev => ({ ...prev, matchHistory: sampleMatches }));
  }, []);

  // --- New MMR Estimation and RP Gain Projection ---
  const calculateMMR = (currentRank: string, currentRP: number, matchHistory: MatchData[]): number => {
    if (matchHistory.length === 0) {
      // Fallback to rank-based estimation if no match history
      const division = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
      const base = GLICKO_RATINGS[division];
      const rpProgress = Math.max(0, Math.min(1, currentRP / 100));
      const nextDivision = Math.min(division + 1, RANK_NAMES.length - 1);
      const next = GLICKO_RATINGS[nextDivision];
      return Math.round(base + (next - base) * rpProgress);
    }

    // Enhanced progression-based MMR calculation
    // Start from current state and work backwards through matches
    let estimatedMMR = (() => {
      const division = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
      const base = GLICKO_RATINGS[division];
      const rpProgress = Math.max(0, Math.min(1, currentRP / 100));
      const nextDivision = Math.min(division + 1, RANK_NAMES.length - 1);
      const next = GLICKO_RATINGS[nextDivision];
      return Math.round(base + (next - base) * rpProgress);
    })();

    // Work backwards through matches to reconstruct MMR progression
    const reversedMatches = [...matchHistory].reverse(); // Oldest to newest
    let trackedRP = currentRP;
    let trackedRank = currentRank;
    let currentRD = 1.8; // Initialize RD tracking
    
    // Track RP gain trends for convergence detection
    const recentWinRPGains: number[] = [];
    const recentLossRPLosses: number[] = [];
    
    // Calculate base weights for recent match emphasis
    const totalMatches = reversedMatches.length;
    const recentMatchCount = Math.min(5, Math.floor(totalMatches * 0.4)); // Last 40% of matches, max 5

    for (let i = 0; i < reversedMatches.length; i++) {
      const match = reversedMatches[i];
      
      // Determine match weight based on recency
      const isRecentMatch = i < recentMatchCount;
      const matchWeight = isRecentMatch ? 1.5 : 1.0;
      
      // Calculate expected RP change for this rank/MMR with rank difficulty scaling
      const expectedWinRP = getExpectedRPForRankWithScaling(trackedRank, estimatedMMR, 'win', false);
      const expectedLossRP = getExpectedRPForRankWithScaling(trackedRank, estimatedMMR, 'loss', false);
      
      // Compare actual vs expected RP change
      const actualRPChange = match.rpChange;
      const expectedRPChange = match.outcome === 'win' ? expectedWinRP : expectedLossRP;
      
      // Track recent trends for convergence detection
      if (match.outcome === 'win' && recentWinRPGains.length < 5) {
        recentWinRPGains.push(actualRPChange);
      } else if (match.outcome === 'loss' && recentLossRPLosses.length < 5) {
        recentLossRPLosses.push(actualRPChange);
      }
      
      // Adjust MMR based on how much RP change deviates from expected
      const rpDeviation = actualRPChange - expectedRPChange;
      
      // Use RD to scale the adjustment (higher RD = more uncertainty = larger adjustments)
      const rdFactor = Math.max(0.5, Math.min(2.0, currentRD / 1.5));
      let mmrAdjustment = rpDeviation * 1.5 * matchWeight * rdFactor;
      
      // Convergence detection: if recent RP gains are decreasing, reduce adjustment
      if (isRecentMatch && recentWinRPGains.length >= 3) {
        const recentGains = recentWinRPGains.slice(-3);
        const isConverging = recentGains[0] > recentGains[recentGains.length - 1];
        if (isConverging && match.outcome === 'win') {
          mmrAdjustment *= 0.7; // Reduce adjustment for converging players
        }
      }
      
      estimatedMMR += mmrAdjustment;
      
      // Update current RP and rank for next iteration
      if (match.outcome === 'win') {
        trackedRP = Math.max(0, trackedRP - actualRPChange);
      } else if (match.outcome === 'loss') {
        trackedRP = Math.min(99, trackedRP - actualRPChange);
      }
      
      // Handle rank changes if RP goes out of bounds
      if (trackedRP >= 100) {
        const currentDivision = RANK_DIVISIONS[trackedRank as keyof typeof RANK_DIVISIONS];
        const nextDivision = Math.min(currentDivision + 1, RANK_NAMES.length - 1);
        trackedRank = RANK_NAMES[nextDivision];
        trackedRP = trackedRP - 100;
      } else if (trackedRP < 0) {
        const currentDivision = RANK_DIVISIONS[trackedRank as keyof typeof RANK_DIVISIONS];
        const prevDivision = Math.max(currentDivision - 1, 0);
        trackedRank = RANK_NAMES[prevDivision];
        trackedRP = 100 + trackedRP;
      }
    }

    // Edge case handling: if no losses, adjust based on win rate
    const winRate = matchHistory.filter(m => m.outcome === 'win').length / matchHistory.length;
    const drawRate = matchHistory.filter(m => m.outcome === 'draw').length / matchHistory.length;
    
    if (winRate > 0.8 && recentLossRPLosses.length === 0) {
      // High win rate with no recent losses - likely underranked
      estimatedMMR += 50;
    } else if (drawRate > 0.3) {
      // High draw rate - reduce confidence in MMR estimate
      estimatedMMR *= 0.95;
    }

    return Math.round(estimatedMMR);
  };

  // Enhanced RP calculation system based on real data patterns
  const getExpectedRPForRankWithScaling = (rank: string, mmr: number, outcome: 'win' | 'loss', isNorm: boolean = false): number => {
    const division = RANK_DIVISIONS[rank as keyof typeof RANK_DIVISIONS];
    const rankBaseline = GLICKO_RATINGS[division];
    
    // Get rank-specific RP values based on real data analysis
    const { baseWinRP, baseLossRP } = getRankSpecificRPValues(rank);
    
    let winAdjustment = 0;
    let lossAdjustment = 0;
    let rpModifier = 1.0;
    
    if (isNorm) {
      // For "norm" calculations, we want to show what a typical player at this rank/RP would expect
      // This means we should have slightly lower gains and higher losses as RP increases within a rank
      // Extract RP progress within the rank (0-99, except Nightmare)
      const rpProgress = rank === 'NIGHTMARE_1' ? Math.min(mmr - rankBaseline, 500) / 500 : (mmr - rankBaseline) / 100;
      
      // As RP increases within a rank, gains should decrease slightly and losses should increase slightly
      // This creates the typical ranked system behavior where higher RP = harder to gain, easier to lose
      winAdjustment = -rpProgress * 2; // Decrease gains as RP increases
      lossAdjustment = rpProgress * 2;  // Increase losses as RP increases
    } else {
      // For personalized calculations, use the original MMR-based adjustment logic
      let mmrRatio: number;
      if (rank === 'NIGHTMARE_1') {
        // For Nightmare, use the same extension logic as calculateExpectedMMR
        // Glicko-2 treats all ratings equally, so we maintain linear progression above 2500
        const maxExtension = 500;
        const mmrDifference = mmr - rankBaseline;
        mmrRatio = mmrDifference / maxExtension;
      } else {
        // Normal calculation for all other ranks
        const nextRankBaseline = GLICKO_RATINGS[Math.min(division + 1, RANK_NAMES.length - 1)];
        const mmrDifference = mmr - rankBaseline;
        const rankRange = nextRankBaseline - rankBaseline;
        mmrRatio = mmrDifference / rankRange;
      }
      
      // Adjust based on MMR difference (how much above/below expected for this rank)
      winAdjustment = mmrRatio * 8;
      lossAdjustment = mmrRatio * 6;
      
      // Add dynamic difficulty penalty for Nightmare players
      if (rank === 'NIGHTMARE_1') {
        const expectedMMR = calculateExpectedMMR(rank, 50); // Use 50 RP as baseline
        const mmrGap = mmr - expectedMMR;
        // Penalty curve: overranked players get reduced gains, underranked get bonuses
        rpModifier = Math.max(0.75, Math.min(1.25, 1 - (mmrGap / 500))); // Clamps at 75% to 125%
      }
    }
    
    if (outcome === 'win') {
      const calculatedRP = Math.round((baseWinRP + winAdjustment) * rpModifier);
      // Apply +10 RP gain floor
      return Math.max(10, calculatedRP);
    } else {
      return Math.round((baseLossRP + lossAdjustment) * rpModifier);
    }
  };

  // New function: Get rank-specific RP values based on real data analysis
  const getRankSpecificRPValues = (rank: string): { baseWinRP: number; baseLossRP: number } => {
    const rankTier = getRankTier(rank);
    
    // Enhanced to provide sub-tier specific values for more granular progression
    // This allows gradual changes between sub-tiers (e.g., GOLD_1 vs GOLD_3) even at same RP
    
    // Extract sub-tier number (1, 2, 3) from rank string
    const subTierMatch = rank.match(/_(\d+)$/);
    const subTier = subTierMatch ? parseInt(subTierMatch[1]) : 1;
    
    // Base values per major rank tier
    const baseValues = {
      'BRONZE': { baseWinRP: 18, baseLossRP: -15 },
      'SILVER': { baseWinRP: 16, baseLossRP: -18 },
      'GOLD': { baseWinRP: 21, baseLossRP: -20 },
      'PLATINUM': { baseWinRP: 14, baseLossRP: -27 },
      'DIAMOND': { baseWinRP: 12, baseLossRP: -30 },
      'EMERALD': { baseWinRP: 10, baseLossRP: -20 },
      'NIGHTMARE': { baseWinRP: 10, baseLossRP: -16 }
    };
    
    const baseValue = baseValues[rankTier as keyof typeof baseValues] || { baseWinRP: 15, baseLossRP: -20 };
    
    // Apply sub-tier progression within the major rank
    // Higher sub-tiers (3) get slightly higher base values than lower sub-tiers (1)
    // This creates the gradual change the user expects between sub-tiers
    // Reduced multiplier to prevent excessive values
    const subTierMultiplier = 1 + (subTier - 1) * 0.05; // 1.0 for tier 1, 1.05 for tier 2, 1.1 for tier 3
    
    return {
      baseWinRP: Math.round(baseValue.baseWinRP * subTierMultiplier),
      baseLossRP: Math.round(baseValue.baseLossRP * subTierMultiplier)
    };
  };

  // New function: Calculate expected RP changes using baseline MMR for the rank (norm)
  const calculateExpectedRPNorm = (currentRank: string, currentRP: number, outcome: 'win' | 'loss'): number => {
    // Calculate the expected MMR for this rank and RP combination
    // This ensures the "norm" values are based on the expected MMR for a typical player at this rank/RP
    const expectedMMR = calculateExpectedMMR(currentRank, currentRP);
    
    // Use the norm-specific scaling logic that shows typical progression within a rank
    return getExpectedRPForRankWithScaling(currentRank, expectedMMR, outcome, true);
  };

  // New function: Calculate expected RP changes using player's actual MMR (personalized)
  const calculateExpectedRPPersonalized = (playerMMR: number, currentRank: string, currentRP: number, outcome: 'win' | 'loss'): number => {
    return getExpectedRPForRankWithScaling(currentRank, playerMMR, outcome, false);
  };

  // Updated function: Calculate expected RP gain based on current MMR and rank difficulty
  const calculateExpectedRPGain = (playerMMR: number, currentRank: string, currentRP: number): number => {
    return getExpectedRPForRankWithScaling(currentRank, playerMMR, 'win', false);
  };

  // Updated function: Calculate expected RP loss based on current MMR and rank difficulty  
  const calculateExpectedRPLoss = (playerMMR: number, currentRank: string, currentRP: number): number => {
    return getExpectedRPForRankWithScaling(currentRank, playerMMR, 'loss', false);
  };

  // Calculate weighted average RP gain from recent match history (recent matches weighted more)
  const calculateAverageRPGain = (matchHistory: MatchData[]): number => {
    const winMatches = matchHistory.filter(m => m.outcome === 'win');
    if (winMatches.length === 0) return 15; // Default fallback
    
    // Apply recency weighting: more recent matches have higher weight
    const weightedSum = winMatches.reduce((sum, match, index) => {
      const recencyWeight = Math.pow(0.9, index); // Recent matches get higher weight
      return sum + (match.rpChange * recencyWeight);
    }, 0);
    
    const totalWeight = winMatches.reduce((sum, _, index) => {
      return sum + Math.pow(0.9, index);
    }, 0);
    
    return Math.round(weightedSum / totalWeight);
  };

  // Calculate weighted average RP loss from recent match history (recent matches weighted more, excluding shielded losses)
  const calculateAverageRPLoss = (matchHistory: MatchData[]): number => {
    // Filter out shielded losses (0 RP loss) and only count actual RP losses
    const actualLossMatches = matchHistory.filter(m => 
      m.outcome === 'loss' && m.rpChange < 0 && !m.wasShielded
    );
    
    if (actualLossMatches.length === 0) return -12; // Default fallback
    
    // Apply recency weighting: more recent matches have higher weight
    const weightedSum = actualLossMatches.reduce((sum, match, index) => {
      const recencyWeight = Math.pow(0.9, index); // Recent matches get higher weight
      return sum + (match.rpChange * recencyWeight);
    }, 0);
    
    const totalWeight = actualLossMatches.reduce((sum, _, index) => {
      return sum + Math.pow(0.9, index);
    }, 0);
    
    return Math.round(weightedSum / totalWeight);
  };

  const projectRPGains = (playerMMR: number, currentRank: string): number => {
    // Use the new rank-specific RP calculation system
    return calculateExpectedRPGain(playerMMR, currentRank, playerData.currentRP);
  };

  const getStatus = (playerMMR: number, currentRank: string): { status: string; diff: number } => {
    const expectedMMR = calculateExpectedMMR(currentRank, playerData.currentRP);
    const threshold = getRankThreshold(currentRank);
    const diff = playerMMR - expectedMMR;
    if (diff > threshold) return { status: 'Underranked', diff: Math.round(diff) };
    if (diff < -threshold) return { status: 'Overranked', diff: Math.round(diff) };
    return { status: 'Normal', diff: Math.round(diff) };
  };

  const calculateAccuracy = (data: PlayerData): { score: 'Low' | 'Medium' | 'High'; percentage: number } => {
    let score = 0;
    
    if (data.matchHistory.length >= 8) score += 40;
    else if (data.matchHistory.length >= 5) score += 30;
    else if (data.matchHistory.length >= 3) score += 20;
    else score += 10;
    
    if (data.matchHistory.length > 0) {
      const rpChanges = data.matchHistory.map(m => Math.abs(m.wasShielded ? 12 : m.rpChange));
      const avgChange = rpChanges.reduce((a, b) => a + b, 0) / rpChanges.length;
      const variance = rpChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / rpChanges.length;
      
      if (variance < 25) score += 30;
      else if (variance < 50) score += 20;
      else score += 10;
    }
    
    if (!data.isNewSeason) score += 15;
    else score += 10;
    
    if (data.matchHistory.length >= 5) {
      const wins = data.matchHistory.filter(m => m.outcome === 'win').length;
      const winRate = wins / data.matchHistory.length;
      if (winRate >= 0.4 && winRate <= 0.7) score += 15;
      else if (winRate >= 0.3 && winRate <= 0.8) score += 10;
      else score += 5;
    }
    
    score -= 10; // Penalty for missing total match context
    
    const shieldedMatches = data.matchHistory.filter(m => m.wasShielded).length;
    if (shieldedMatches > 0) score += 5;
    
    const percentage = Math.max(0, Math.min(100, score));
    
    let rating: 'Low' | 'Medium' | 'High';
    if (percentage >= 75) rating = 'High';
    else if (percentage >= 50) rating = 'Medium';
    else rating = 'Low';
    
    return { score: rating, percentage };
  };

  
  const calculateShieldStatus = (data: PlayerData) => {
    const recentLossesAt0RP = data.matchHistory
      .filter(match => match.outcome === 'loss' && (match.rpChange === 0 || match.wasShielded))
      .length;
    
    const isAt0RP = data.currentRP === 0;
    const shieldGames = data.shieldGamesUsed || recentLossesAt0RP;
    
    return {
      active: isAt0RP && shieldGames > 0,
      gamesUsed: shieldGames,
      warning: shieldGames >= 2
    };
  };

  // Calculate RD and Volatility based on match history with recency weighting
  const calculateRDAndVolatility = (matchHistory: MatchData[], baseRD: number = 1.8, baseVol: number = 0.08) => {
    if (matchHistory.length === 0) {
      return { rd: baseRD, vol: baseVol };
    }

    // Enhanced RD calculation with recency weighting
    const totalGames = matchHistory.length;
    const recentGames = Math.min(5, totalGames); // Last 5 games weighted more heavily
    
    // RD decreases faster for recent activity
    const recentRdDecay = Math.min(0.3, recentGames * 0.08); // Recent games have more impact
    const totalRdDecay = Math.min(0.5, totalGames * 0.05); // Overall decay
    let rd = Math.max(0.8, baseRD - (recentRdDecay + totalRdDecay * 0.5));

    // Enhanced volatility calculation with recency weighting
    const rpChanges = matchHistory.map(m => m.rpChange);
    const meanRP = rpChanges.reduce((sum, rp) => sum + rp, 0) / rpChanges.length;
    
    // Weighted variance calculation (recent matches count more)
    let weightedVariance = 0;
    let totalWeight = 0;
    
    rpChanges.forEach((rp, index) => {
      const recencyWeight = Math.max(0.5, 1.0 - (index * 0.1)); // Recent matches weighted 1.0, older matches down to 0.5
      weightedVariance += Math.pow(rp - meanRP, 2) * recencyWeight;
      totalWeight += recencyWeight;
    });
    
    const weightedStdDev = Math.sqrt(weightedVariance / totalWeight);
    
    // Base volatility based on weighted consistency
    let vol = baseVol;
    if (weightedStdDev > 10) vol += 0.02; // High variance
    if (weightedStdDev > 15) vol += 0.03; // Very high variance
    if (weightedStdDev < 5) vol -= 0.01;  // Low variance
    
    // Recent performance affects volatility more (last 3 matches)
    const recentMatches = matchHistory.slice(0, 3);
    const recentVariance = recentMatches.reduce((sum, m) => sum + Math.pow(m.rpChange - meanRP, 2), 0) / recentMatches.length;
    const recentStdDev = Math.sqrt(recentVariance);
    
    if (recentStdDev > weightedStdDev * 1.5) vol += 0.03; // Recent inconsistency (increased impact)
    if (recentStdDev < weightedStdDev * 0.5) vol -= 0.02; // Recent consistency (increased impact)
    
    // Additional recency factor: if recent performance is very different from overall
    const recentMean = recentMatches.reduce((sum, m) => sum + m.rpChange, 0) / recentMatches.length;
    const overallMean = rpChanges.reduce((sum, rp) => sum + rp, 0) / rpChanges.length;
    const meanDifference = Math.abs(recentMean - overallMean);
    
    if (meanDifference > 8) vol += 0.02; // Recent performance significantly different from overall
    
    return {
      rd: Math.max(0.8, Math.min(2.0, rd)),
      vol: Math.max(0.04, Math.min(0.15, vol))
    };
  };

  useEffect(() => {
    const mmr = calculateMMR(playerData.currentRank, playerData.currentRP, playerData.matchHistory);
    const { rd, vol } = calculateRDAndVolatility(playerData.matchHistory);
    setCalculatedMMR({ rating: mmr, rd, vol });
    setProjectedRP(projectRPGains(mmr, playerData.currentRank));
    
    const accuracy = calculateAccuracy(playerData);
    setAccuracyScore(accuracy.score);
    setAccuracyPercentage(accuracy.percentage);
    
    const shield = calculateShieldStatus(playerData);
    setShieldStatus(shield);
    setDemotionShieldActive(shield.active);
  }, [playerData]);

  const addMatch = () => {
    setPlayerData(prev => ({
      ...prev,
      matchHistory: [
        { id: nextMatchId.toString(), outcome: 'win', rpChange: 15, wasShielded: false },
        ...prev.matchHistory
      ]
    }));
    setNextMatchId(id => id + 1);
  };

  const updateMatch = (id: string, field: keyof MatchData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      matchHistory: prev.matchHistory.map(match => {
        if (match.id !== id) return match;
        // If changing outcome to 'draw', force rpChange to 0
        if (field === 'outcome' && value === 'draw') {
          return { ...match, outcome: value, rpChange: 0, wasShielded: false };
        }
        // If editing rpChange, enforce rules based on outcome
        if (field === 'rpChange') {
          if (match.outcome === 'win') {
            // Only allow positive values (min 1)
            const rp = Math.max(1, parseInt(value) || 1);
            return { ...match, rpChange: rp };
          } else if (match.outcome === 'loss') {
            // Only allow negative values (max -1)
            const rp = Math.min(-1, parseInt(value) || -1);
            return { ...match, rpChange: rp };
          } else if (match.outcome === 'draw') {
            // Always 0 for draw
            return { ...match, rpChange: 0 };
          }
        }
        // If changing outcome to win/loss, adjust rpChange if needed
        if (field === 'outcome' && value === 'win') {
          const rp = match.rpChange > 0 ? match.rpChange : 15;
          return { ...match, outcome: value, rpChange: rp, wasShielded: false };
        }
        if (field === 'outcome' && value === 'loss') {
          const rp = match.rpChange < 0 ? match.rpChange : -12;
          return { ...match, outcome: value, rpChange: rp };
        }
        // Default
        return { ...match, [field]: value };
      })
    }));
  };

  const removeMatch = (id: string) => {
    setPlayerData(prev => ({
      ...prev,
      matchHistory: prev.matchHistory.filter(match => match.id !== id)
    }));
  };

  const getAccuracyColor = (accuracy: string) => {
    switch (accuracy) {
      case 'High': return 'text-green-600 bg-green-50 border-green-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRatingDifference = () => {
    if (!calculatedMMR) return { diff: 0, status: 'aligned' };
    
    const expectedMMR = calculateExpectedMMR(playerData.currentRank, playerData.currentRP);
    const threshold = getRankThreshold(playerData.currentRank);
    const diff = calculatedMMR.rating - expectedMMR;
    
    if (diff > threshold) return { diff, status: 'underranked' };
    if (diff < -threshold) return { diff, status: 'overranked' };
    return { diff, status: 'aligned' };
  };

  const ratingDiff = getRatingDifference();

  const kFactor = 32; // Could be dynamic per rank
  const playerGlicko = calculatedMMR?.rating || 1500;

  // Auto-populate averages from match history if available
  const autoAvgWin = getAvgRP(playerData.matchHistory, 'win') || 15;
  const autoAvgLoss = getAvgRP(playerData.matchHistory, 'loss') || -12;

  let usedAvgWin = avgRPWin;
  let usedAvgLoss = avgRPLoss;
  if (predictionTab === 'auto') {
    usedAvgWin = autoAvgWin;
    usedAvgLoss = autoAvgLoss;
  }
  if (predictionTab === 'win' && !avgRPWin) usedAvgWin = autoAvgWin;
  if (predictionTab === 'loss' && !avgRPLoss) usedAvgLoss = autoAvgLoss;

  // Predict counter RP
  let predictedLoss = null, predictedWin = null, opponentSkill = null, symmetryWarning = '';
  if (predictionTab === 'win' && usedAvgWin) {
    predictedLoss = predictCounterRP(usedAvgWin, 1, playerGlicko, kFactor);
    opponentSkill = estimateOpponentGlicko(playerGlicko, usedAvgWin, 1, kFactor);
  } else if (predictionTab === 'loss' && usedAvgLoss) {
    predictedWin = predictCounterRP(usedAvgLoss, 0, playerGlicko, kFactor);
    opponentSkill = estimateOpponentGlicko(playerGlicko, usedAvgLoss, 0, kFactor);
  } else if (predictionTab === 'auto') {
    predictedLoss = predictCounterRP(usedAvgWin, 1, playerGlicko, kFactor);
    predictedWin = predictCounterRP(usedAvgLoss, 0, playerGlicko, kFactor);
    opponentSkill = estimateOpponentGlicko(playerGlicko, usedAvgWin, 1, kFactor);
  }
  // Symmetry check
  const symmetry = validateRPSymmetry(usedAvgWin, usedAvgLoss, playerGlicko, kFactor);
  if (symmetry.warning) symmetryWarning = symmetry.warning;

  // --- Simulation Inputs ---
  const winRate = 0.5; // For now, assume 50% win rate (could be user input)
  // --- Confidence Calculation ---
  let confidence = 'Medium';
  if (playerData.matchHistory.length >= 8) confidence = 'High';
  else if (playerData.matchHistory.length <= 2) confidence = 'Low';
  if (symmetryWarning) confidence = 'Low';

  // --- Info Tab Visibility Control ---
  // TODO: Replace with real admin check
  const isAdmin = window.localStorage.getItem('isAdmin') === 'true';
  const [infoTabAdminOnly, setInfoTabAdminOnly] = useState(
    localStorage.getItem('mmrInfoTabAdminOnly') !== 'false'
  );
  useEffect(() => {
    const handler = () => setInfoTabAdminOnly(localStorage.getItem('mmrInfoTabAdminOnly') !== 'false');
    window.addEventListener('mmrInfoTabAdminOnlyChanged', handler);
    return () => window.removeEventListener('mmrInfoTabAdminOnlyChanged', handler);
  }, []);

  const MAIN_TABS = [
    { key: 'calculator', label: 'MMR Calculator', icon: <Calculator size={18} /> },
    { key: 'advanced', label: 'Advanced RP Prediction', icon: <BarChart2 size={18} /> },
    { key: 'history', label: 'MMR User History', icon: <History size={18} />, disabled: !user },
    // Only show Info tab if allowed
    ...((!infoTabAdminOnly || isAdmin) ? [
      { key: 'info', label: 'Info', icon: <BookOpen size={18} /> }
    ] : [])
  ];
  const [mainTab, setMainTab] = useState<'calculator' | 'advanced' | 'info' | 'history'>('calculator');

  // In the BedWarsMMRCalculator component, add state for simplified prediction:
  const [gamesToPredict, setGamesToPredict] = useState(10);
  const recentWinRate = playerData.matchHistory.length > 0 ? Math.round((playerData.matchHistory.filter(m => m.outcome === 'win').length / playerData.matchHistory.length) * 100) : 50;
  const [expectedWinRate, setExpectedWinRate] = useState(recentWinRate);
  // Instead of redeclaring avgRPWin and avgRPLoss, update them when playerData.matchHistory changes:
  useEffect(() => {
    if (playerData.matchHistory.length > 0) {
      const winMatches = playerData.matchHistory.filter(m => m.outcome === 'win');
      const lossMatches = playerData.matchHistory.filter(m => m.outcome === 'loss');
      const avgWin = winMatches.length > 0 ? Math.round(winMatches.reduce((sum, m) => sum + m.rpChange, 0) / winMatches.length) : 15;
      const avgLoss = lossMatches.length > 0 ? Math.round(lossMatches.reduce((sum, m) => sum + m.rpChange, 0) / lossMatches.length) : -12;
      setAvgRPWin(avgWin);
      setAvgRPLoss(avgLoss);
    } else {
      setAvgRPWin(15);
      setAvgRPLoss(-12);
    }
  }, [playerData.matchHistory]);

  // Add state for winrate input mode
  const [winRateMode, setWinRateMode] = useState<'percent' | 'count'>('percent');
  const [expectedWins, setExpectedWins] = useState(Math.round((expectedWinRate / 100) * gamesToPredict));

  // --- Save MMR Function ---
  const savePlayerSnapshot = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!calculatedMMR) {
      setErrorMessage('❌ No MMR data available to save. Please calculate your MMR first.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Calculate all required values
      const ratingDiff = getRatingDifference();
      const avgRPWin = calculateAverageRPGain(playerData.matchHistory);
      const avgRPLoss = calculateAverageRPLoss(playerData.matchHistory);
      const recentWinRate = playerData.matchHistory.length > 0 
        ? (playerData.matchHistory.filter(m => m.outcome === 'win').length / playerData.matchHistory.length) * 100
        : 0;

      // 1. Insert MMR snapshot
      const snapshot = await saveMMRSnapshot({
        user_id: user.id,
        current_rank: playerData.currentRank,
        current_rp: playerData.currentRP,
        estimated_glicko: calculatedMMR.rating,
        estimated_rd: calculatedMMR.rd,
        estimated_volatility: calculatedMMR.vol,
        accuracy_score: accuracyPercentage,
        avg_rp_per_win: avgRPWin,
        avg_rp_per_loss: avgRPLoss,
        recent_win_rate: recentWinRate,
        total_wins: playerData.totalWins,
        shield_games_used: playerData.shieldGamesUsed || 0,
        is_new_season: playerData.isNewSeason,
        previous_season_mmr: playerData.previousSeasonMMR,
        skill_gap: ratingDiff.diff,
        ranking_status: ratingDiff.status,
        user_notes: userNotes
      });

      // 2. Process match history
      if (playerData.matchHistory.length > 0) {
        await processMatchHistory(
          user.id,
          snapshot.id,
          playerData.matchHistory.map(match => ({
            outcome: match.outcome,
            rpChange: match.rpChange,
            wasShielded: match.wasShielded || false
          }))
        );
      }

      // 3. Refresh user stats
      const stats = await getUserMatchStats(user.id);
      setUserStats(stats);
      
      setSuccessMessage(`✅ MMR Progress Saved! Total contributions: ${(stats?.total_snapshots || 0)}`);
      
    } catch (error) {
      console.error('Error saving MMR:', error);
      setErrorMessage('❌ Failed to save MMR snapshot. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Load user stats on mount
  useEffect(() => {
    if (user) {
      getUserMatchStats(user.id).then(setUserStats).catch(console.error);
    }
  }, [user]);

  // Keep expectedWins and expectedWinRate in sync
  useEffect(() => {
    if (winRateMode === 'percent') {
      setExpectedWins(Math.round((expectedWinRate / 100) * gamesToPredict));
    }
  }, [expectedWinRate, gamesToPredict, winRateMode]);
  useEffect(() => {
    if (winRateMode === 'count') {
      setExpectedWinRate(Math.round((expectedWins / gamesToPredict) * 100));
    }
  }, [expectedWins, gamesToPredict, winRateMode]);

  // Generate simulation data for the graph
  function handleRankProgression(currentRP: number, currentRank: string) {
    // Use the same logic as your rank system for promotions
    const rankOrder = RANK_NAMES;
    let division = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
    let promoted = false;
    if (currentRP >= 100 && division < rankOrder.length - 1) {
      currentRP -= 100;
      division++;
      promoted = true;
    }
    if (currentRP < 0 && division > 0) {
      currentRP += 100;
      division--;
    }
    return { newRP: currentRP, newRank: rankOrder[division], promoted };
  }

  // --- Skill Gap Calculation (interpolated within rank) ---
  function calculateSkillGap(currentGlicko: number, currentRank: string, currentRP: number) {
    const rankDivision = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
    const rankBaselineGlicko = GLICKO_RATINGS[rankDivision];
    const nextRankGlicko = GLICKO_RATINGS[rankDivision + 1] !== undefined ? GLICKO_RATINGS[rankDivision + 1] : rankBaselineGlicko + 100;
    const rpProgress = currentRP / 100;
    const expectedGlickoAtThisRP = rankBaselineGlicko + (nextRankGlicko - rankBaselineGlicko) * rpProgress;
    return currentGlicko - expectedGlickoAtThisRP;
  }

  // --- Enhanced Glicko Update Function (with volatility and skill gap sensitivity) ---
  function updateGlickoAfterMatch(currentGlicko: number, currentRD: number, currentVol: number, matchResult: 'win' | 'loss', skillGap: number) {
    // Glicko changes based on match outcome, volatility, and skill gap
    const baseChange = matchResult === 'win' ? 25 : -18; // Slightly larger for more visible effect
    const rdFactor = Math.max(0.5, currentRD / 2.0);
    const skillFactor = 1 + Math.abs(skillGap) / 200; // More sensitive to skill gap
    const ratingChange = baseChange * rdFactor * skillFactor * (matchResult === 'win' ? 1 : -1);
    return {
      rating: currentGlicko + ratingChange,
      rd: Math.max(0.8, currentRD - 0.03),
      vol: Math.max(0.04, currentVol + Math.abs(ratingChange) * 0.001)
    };
  }

  // --- Dynamic RP Calculation (continuous, with stronger within-rank scaling) ---
  function calculateDynamicRP(currentGlicko: number, currentRank: string, currentRP: number, matchResult: 'win' | 'loss') {
    // Get rank-specific base RP values instead of using old difficulty multipliers
    const { baseWinRP, baseLossRP } = getRankSpecificRPValues(currentRank);
    const baseRP = matchResult === 'win' ? baseWinRP : baseLossRP;
    
    // 1. Skill gap multiplier (continuous within ranks)
    const skillGap = calculateSkillGap(currentGlicko, currentRank, currentRP);
    let skillMultiplier = 1.0;
    if (matchResult === 'win') {
      skillMultiplier = Math.max(0.6, 1.0 - (skillGap / 400));
    } else {
      skillMultiplier = Math.min(1.4, 1.0 + Math.abs(skillGap) / 500);
    }
    
    // 2. Within-rank difficulty progression (now 15% harder at 99 RP)
    const rpProgress = currentRank === 'NIGHTMARE_1' ? Math.min(currentRP / 100, 1) : currentRP / 100;
    const withinRankMultiplier = 1.0 - (rpProgress * 0.15); // 15% harder at 99 RP vs 0 RP
    
    const calculatedRP = Math.round(baseRP * skillMultiplier * withinRankMultiplier);
    
    // Apply +10 RP gain floor for wins
    if (matchResult === 'win') {
      return Math.max(10, calculatedRP);
    } else {
      return calculatedRP;
    }
  }

  // --- Promotion/Demotion RP Adjustment (using new rank's interpolated Glicko) ---
  function adjustRPForRankChange(baseRP: number, expectedMMR: number, newRank: string, newRP: number, wasPromoted: boolean) {
    const newRankDivision = RANK_DIVISIONS[newRank as keyof typeof RANK_DIVISIONS];
    const newRankBaseline = GLICKO_RATINGS[newRankDivision];
    const nextRankGlicko = GLICKO_RATINGS[newRankDivision + 1] !== undefined ? GLICKO_RATINGS[newRankDivision + 1] : newRankBaseline + 100;
    const rpProgress = newRP / 100;
    const expectedGlickoAtNewRank = newRankBaseline + (nextRankGlicko - newRankBaseline) * rpProgress;
    const skillGapAtNewRank = expectedMMR - expectedGlickoAtNewRank;
    if (wasPromoted) {
      const difficultyIncrease = Math.max(0.7, 1.0 - (skillGapAtNewRank / 300));
      return Math.round(baseRP * difficultyIncrease);
    } else {
      const recoveryBonus = Math.min(1.3, 1.0 + Math.abs(skillGapAtNewRank) / 400);
      return Math.round(baseRP * recoveryBonus);
    }
  }

  // --- Shield System Effects ---
  function applyShieldEffects(rpChange: number, matchResult: 'win' | 'loss', isShielded: boolean, currentRP: number) {
    if (isShielded && matchResult === 'loss' && currentRP === 0) {
      // RP doesn't drop but MMR still decreases
      return {
        visibleRPChange: 0,
        actualMMREffect: rpChange // Still process the loss for MMR
      };
    }
    return {
      visibleRPChange: rpChange,
      actualMMREffect: rpChange
    };
  }

  // --- Simulation Engine for RP Progression (full dynamic, all factors) ---
  function simulateRPProgression({
    games,
    winRate,
    startRP,
    startRank,
    startGlicko,
    startRD = 1.8,
    startVol = 0.08,
    avgRPWin = 15,
    avgRPLoss = -12,
    shieldGamesUsed = 0,
    rankDivisions = RANK_DIVISIONS,
    glickoRatings = GLICKO_RATINGS,
    rankNames = RANK_NAMES
  }: {
    games: number;
    winRate: number;
    startRP: number;
    startRank: string;
    startGlicko: number;
    startRD?: number;
    startVol?: number;
    avgRPWin?: number;
    avgRPLoss?: number;
    shieldGamesUsed?: number;
    rankDivisions?: typeof RANK_DIVISIONS;
    glickoRatings?: typeof GLICKO_RATINGS;
    rankNames?: string[];
  }) {
    let currentRP = startRP;
    let currentRank = startRank;
    let currentGlicko = startGlicko;
    let currentRD = startRD;
    let currentVol = startVol;
    let currentShieldGames = shieldGamesUsed || 0;
    let promotions: any[] = [];
    let demotions: any[] = [];
    let data: any[] = [];
    let division = rankDivisions[startRank as keyof typeof rankDivisions];
    for (let i = 1; i <= games; i++) {
      const isWin = Math.random() < (winRate / 100);
      const matchResult = isWin ? 'win' : 'loss';
      // Calculate expected MMR for current rank and RP (for RP calculations)
      const expectedMMRForCurrentState = calculateExpectedMMR(currentRank, currentRP);
      
      // Dynamic RP calculation using expected MMR (not actual MMR)
      let rpChange = calculateDynamicRP(expectedMMRForCurrentState, currentRank, currentRP, matchResult);
      // Shield logic (simulate only, not full BedWars logic)
      let isShielded = false;
      if (matchResult === 'loss' && currentRP === 0 && currentShieldGames < 3) {
        isShielded = true;
        currentShieldGames++;
      }
      const shieldEffects = applyShieldEffects(rpChange, matchResult, isShielded, currentRP);
      let newRP = currentRP + shieldEffects.visibleRPChange;
      let promoted = false;
      let demoted = false;
      let newRank = currentRank;
      let newDivision = division;
      // Promotion
      if (newRP >= 100 && currentRank !== 'NIGHTMARE_1') {
        newRP -= 100;
        newDivision = Math.min(division + 1, rankNames.length - 1);
        newRank = rankNames[newDivision];
        promoted = true;
        promotions.push({ game: i, fromRank: currentRank, toRank: newRank });
      }
      // Demotion
      if (newRP < 0) {
        newRP += 100;
        newDivision = Math.max(division - 1, 0);
        newRank = rankNames[newDivision];
        demoted = true;
        demotions.push({ game: i, fromRank: currentRank, toRank: newRank });
      }
      // Promotion/demotion effects
      if (promoted || demoted) {
        // Recalculate expected MMR for new rank and RP
        const expectedMMRForNewState = calculateExpectedMMR(newRank, newRP);
        rpChange = adjustRPForRankChange(rpChange, expectedMMRForNewState, newRank, newRP, promoted);
        newRP = promoted ? Math.max(0, newRP) : Math.min(99, newRP);
      }
      // Calculate skill gap for Glicko update (using expected MMR)
      const skillGap = calculateSkillGap(expectedMMRForCurrentState, currentRank, currentRP);
      // Glicko update (use expected MMR as base, not actual MMR)
      const glickoUpdate = updateGlickoAfterMatch(expectedMMRForCurrentState, currentRD, currentVol, matchResult, skillGap);
      // Debug output
      // eslint-disable-next-line no-console
      console.log('Match simulation debug:', {
        game: i,
        expectedMMRForCurrentState,
        currentRank,
        currentRP,
        skillGap,
        rpChange,
        visibleRPChange: shieldEffects.visibleRPChange,
        promoted,
        demoted,
        mmrDifference: Math.round(expectedMMRForCurrentState - startGlicko)
      });
      data.push({
        game: i,
        result: matchResult === 'win' ? 'Win' : 'Loss',
        rp: currentRank === 'NIGHTMARE_1' ? newRP : Math.max(0, Math.min(99, newRP)),
        rank: newRank,
        glicko: Math.round(expectedMMRForCurrentState), // Use expected MMR, not inflated actual MMR
        rpChange: shieldEffects.visibleRPChange,
        promoted,
        demoted,
        skillGap: Math.round(skillGap),
        rd: glickoUpdate.rd
      });
      // Carry forward for next match (use expected MMR for next iteration)
      currentGlicko = expectedMMRForCurrentState; // Use expected MMR, not inflated actual MMR
      currentRD = glickoUpdate.rd;
      currentVol = glickoUpdate.vol;
      currentRP = newRP;
      currentRank = newRank;
      division = newDivision;
    }
    return {
      data,
      promotions,
      demotions,
      finalRP: Math.round(currentRP),
      finalRank: currentRank,
      startingGlicko: Math.round(startGlicko),
      finalGlicko: Math.round(calculateExpectedMMR(currentRank, currentRP)) // Use expected MMR for final value
    };
  }

  // --- Simulation and segments ---
  const simulation = simulateRPProgression({
    games: gamesToPredict,
    winRate: expectedWinRate,
    startRP: playerData.currentRP,
    startRank: playerData.currentRank,
    startGlicko: calculatedMMR?.rating || 1500,
    startRD: calculatedMMR?.rd || 1.8,
    startVol: calculatedMMR?.vol || 0.08,
    avgRPWin: avgRPWin,
    avgRPLoss: avgRPLoss,
    shieldGamesUsed: playerData.shieldGamesUsed || 0
  });

  // --- Rank color and zone helpers (moved inside component for access to playerData/simulation) ---
  const RANK_COLORS: Record<string, string> = {
    BRONZE: '#CD7F32',
    SILVER: '#C0C0C0',
    GOLD: '#FFD700',
    PLATINUM: '#00CED1',
    DIAMOND: '#4169E1',
    EMERALD: '#50C878',
    NIGHTMARE: '#8A2BE2'
  };
  const RANK_ZONES = [
    { name: 'BRONZE', min: 0, max: 399, color: '#CD7F32' },
    { name: 'SILVER', min: 400, max: 799, color: '#C0C0C0' },
    { name: 'GOLD', min: 800, max: 1199, color: '#FFD700' },
    { name: 'PLATINUM', min: 1200, max: 1599, color: '#00CED1' },
    { name: 'DIAMOND', min: 1600, max: 1999, color: '#4169E1' },
    { name: 'EMERALD', min: 2000, max: 2399, color: '#50C878' },
    { name: 'NIGHTMARE', min: 2400, max: 3000, color: '#8A2BE2' }
  ];
  function getRankBase(rank: string): string {
    if (rank.startsWith('BRONZE')) return 'BRONZE';
    if (rank.startsWith('SILVER')) return 'SILVER';
    if (rank.startsWith('GOLD')) return 'GOLD';
    if (rank.startsWith('PLATINUM')) return 'PLATINUM';
    if (rank.startsWith('DIAMOND')) return 'DIAMOND';
    if (rank.startsWith('EMERALD')) return 'EMERALD';
    if (rank.startsWith('NIGHTMARE')) return 'NIGHTMARE';
    return 'BRONZE';
  }
  function getRankFromRP(rp: number): string {
    for (let i = RANK_ZONES.length - 1; i >= 0; i--) {
      if (rp >= RANK_ZONES[i].min) return RANK_ZONES[i].name;
    }
    return 'BRONZE';
  }
  function formatYAxis(value: number): string {
    const rank = getRankFromRP(value + (playerData.currentRP || 0));
    if (value % 100 === 0) {
      return `${value} (${rank})`;
    }
    return value.toString();
  }
  // --- Promotion/demotion detection for summary and lines ---
  function detectPromotions(simData: any[]): { game: number; rp: number; fromRank: string; toRank: string; type: 'promotion' | 'demotion' }[] {
    const promotions: { game: number; rp: number; fromRank: string; toRank: string; type: 'promotion' | 'demotion' }[] = [];
    for (let i = 1; i < simData.length; i++) {
      const prev = simData[i - 1];
      const current = simData[i];
      if (getRankTier(current.rank) > getRankTier(prev.rank)) {
        promotions.push({
          game: current.game,
          rp: current.rp,
          fromRank: prev.rank,
          toRank: current.rank,
          type: 'promotion'
        });
      }
      if (getRankTier(current.rank) < getRankTier(prev.rank)) {
        promotions.push({
          game: current.game,
          rp: current.rp,
          fromRank: prev.rank,
          toRank: current.rank,
          type: 'demotion'
        });
      }
    }
    return promotions;
  }
  const promotions = detectPromotions(simulation.data);
  // --- Rank-based line coloring (no segmenting, just color transitions) ---
  // We'll use a single Line with a gradient stroke for smooth transitions
  function getLineGradientStops(data: any[]): { offset: number; color: string }[] {
    const stops: { offset: number; color: string }[] = [];
    const n = data.length;
    for (let i = 0; i < n; i++) {
      const base = getRankBase(data[i].rank);
      const color = RANK_COLORS[base];
      const offset = (i / (n - 1)) * 100;
      stops.push({ offset, color });
    }
    // Remove consecutive duplicates
    return stops.filter((s, i, arr) => i === 0 || s.color !== arr[i - 1].color);
  }
  // --- Custom dot for promotions/demotions ---
  const PromotionDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.promoted && !payload.demoted) return null;
    const isPromotion = payload.promoted;
    const color = isPromotion ? '#10B981' : '#EF4444';
    const icon = isPromotion ? '🎉' : '💔';
    return (
      <g>
        <circle cx={cx} cy={cy} r={12} fill={color} opacity={0.2} />
        <circle cx={cx} cy={cy} r={6} fill={color} stroke="#fff" strokeWidth={2} />
        <text x={cx} y={cy - 15} textAnchor="middle" fontSize="12">{icon}</text>
      </g>
    );
  };
  // --- Enhanced Tooltip ---
  const EnhancedTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string | number }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-w-xs p-3">
          <p className="font-semibold text-gray-800 dark:text-gray-100">Match {label}</p>
          <div className="mt-2">
            <p className={`font-medium ${data.result === 'Win' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{data.result}: {data.rpChange > 0 ? '+' : ''}{data.rpChange} RP</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">RP: {data.rp} ({data.rank.replace('_', ' ')})</p>
            {data.promoted && (<p className="text-green-600 dark:text-green-400 font-bold text-sm">🎉 PROMOTED!</p>)}
            {data.demoted && (<p className="text-red-600 dark:text-red-400 font-bold text-sm">💔 DEMOTED</p>)}
            <p className="text-xs mt-1 font-bold text-purple-700 dark:text-purple-300">MMR: {Math.round(data.glicko)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Ref for recent matches scroll
  const recentMatchesRef = useRef<HTMLDivElement | null>(null);

  // Scroll to top when a new match is added
  useEffect(() => {
    if (recentMatchesRef.current) {
      recentMatchesRef.current.scrollTop = 0;
    }
  }, [playerData.matchHistory]);

  // Place this above the return statement of the component
  const mmrSpectrumSummary = (() => {
    if (!calculatedMMR) return null;
    const expected = calculateExpectedMMR(playerData.currentRank, playerData.currentRP);
    const division = RANK_DIVISIONS[playerData.currentRank as keyof typeof RANK_DIVISIONS];
    const nextDivision = Math.min(division + 1, RANK_NAMES.length - 1);
    const prevDivision = Math.max(division - 1, 0);
    const base = GLICKO_RATINGS[division];
    const next = GLICKO_RATINGS[nextDivision];
    const prev = GLICKO_RATINGS[prevDivision];
    const toPromotion = next - calculatedMMR.rating;
    const toDemotion = calculatedMMR.rating - base;
    let status = '';
    if (calculatedMMR.rating > expected) status = "Your MMR is above the expected for your rank, so you're likely to rank up quickly.";
    else if (calculatedMMR.rating < expected) status = "Your MMR is below the expected for your rank, so you may lose RP faster.";
    else status = 'You are perfectly ranked.';
    return (
      <>
        <div>MMR to next promotion: <span className="font-semibold">{toPromotion > 0 ? toPromotion : 0}</span></div>
        <div>MMR to demotion: <span className="font-semibold">{toDemotion > 0 ? toDemotion : 0}</span></div>
        <div className="mt-1">{status}</div>
      </>
    );
  })();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const newMatchHistory = [...playerData.matchHistory];
    const draggedItem = newMatchHistory[draggedIndex];
    newMatchHistory.splice(draggedIndex, 1);
    newMatchHistory.splice(dropIndex, 0, draggedItem);
    
    setPlayerData(prev => ({ ...prev, matchHistory: newMatchHistory }));
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="w-[1216px] max-w-[1216px] mx-auto py-12 px-0 flex flex-col gap-8 animate-fade-in">
      {/* Mini Header like Leaderboard/Strat Picker */}
      <div className="mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-wide mb-1" style={{letterSpacing: '0.01em'}}>MMR Calculator</h1>
        </div>
      </div>
      {/* Main Tabs - Leaderboard style, full width, rectangle with rounded corners */}
      <div className="w-[1216px] max-w-[1216px] mx-auto mb-0">
        <div className="flex w-[1216px] max-w-[1216px] bg-gray-100 dark:bg-gray-700 p-1 rounded-lg shadow-md">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key as 'calculator' | 'advanced' | 'info' | 'history')}
              disabled={tab.disabled}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-base font-medium transition-all duration-200 focus:outline-none ${
                tab.disabled
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50'
                  : mainTab === tab.key
                  ? 'bg-white dark:bg-gray-900 text-primary-900 dark:text-primary-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
              style={{ minWidth: 0 }}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Main Content */}
      <div className="rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 p-10 animate-fade-in backdrop-blur-md w-[1216px] max-w-[1216px] mx-auto">
        {mainTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_320px_1fr] gap-10 animate-slide-up">
            {/* Player Info */}
            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-md flex flex-col gap-6 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-2">
                <Target className="w-5 h-5" /> Player Information
              </h2>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Current Rank</label>
                <div className="flex items-center gap-2">
                  <select
                    value={playerData.currentRank}
                    onChange={(e) => setPlayerData(prev => ({ ...prev, currentRank: e.target.value }))}
                    className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                  >
                    {RANK_NAMES.map(rank => (
                      <option key={rank} value={rank}>
                        {rank.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <RankBadge
                    rankTitle={playerData.currentRank.replace('_', ' ')}
                    rp={playerData.currentRP}
                    size="small"
                    className="ml-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Current RP</label>
                <input
                  type="number"
                  value={playerData.currentRP}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, currentRP: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                  min="0"
                  max="99"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  RP within the current rank (0-99)
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Total Wins (Season)</label>
                <input
                  type="number"
                  value={playerData.totalWins}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, totalWins: parseInt(e.target.value) || 0 }))}
                  className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                  min="0"
                  placeholder="Total ranked wins this season"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Shield Games Used (0-3)</label>
                <input
                  type="number"
                  value={playerData.shieldGamesUsed || 0}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, shieldGamesUsed: Math.min(3, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                  min="0"
                  max="3"
                  placeholder="How many shield games used?"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Games played at 0 RP without demoting (max 3)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newSeason"
                  checked={playerData.isNewSeason}
                  onChange={(e) => setPlayerData(prev => ({ ...prev, isNewSeason: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 dark:text-primary-400 border-gray-300 dark:border-gray-700 rounded focus:ring-primary-500 dark:focus:ring-primary-400"
                />
                <label htmlFor="newSeason" className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  New Season (rank reset)
                </label>
              </div>
              {playerData.isNewSeason && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Previous Season MMR</label>
                  <input
                    type="number"
                    value={playerData.previousSeasonMMR || ''}
                    onChange={(e) => setPlayerData(prev => ({ ...prev, previousSeasonMMR: parseInt(e.target.value) || undefined }))}
                    className="w-full p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                    placeholder="Enter if known"
                  />
                </div>
              )}
              
              {/* Save Progress Button */}
              <div className="mt-4">
                <button 
                  onClick={savePlayerSnapshot}
                  disabled={!calculatedMMR || isSaving}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Saving Progress...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      📸 Save My MMR Progress
                    </>
                  )}
                </button>
                
                {!user && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
                    <button onClick={() => setShowAuthModal(true)} className="text-blue-600 hover:underline dark:text-blue-400">
                      Sign in
                    </button> to save your progress and unlock premium features
                  </p>
                )}
                
                {user && userStats && (
                  <div className="mt-2 text-sm text-center">
                    <span className="text-green-600 dark:text-green-400">✓ {userStats.total_snapshots} snapshots contributed</span>
                    {userStats.data_contribution_level > 0 && (
                      <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded text-xs">
                        Level {userStats.data_contribution_level} Contributor
                      </span>
                    )}
                  </div>
                )}

                {/* User Notes Input */}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    placeholder="Add notes about this snapshot..."
                    className="w-full p-2 text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:focus:ring-green-400 dark:focus:border-green-400 transition resize-none"
                    rows={2}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 Tip: Write down your account name so you don't lose track of which snapshot is which
                  </p>
                </div>

                {/* Success/Error Messages */}
                {successMessage && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-sm text-green-700 dark:text-green-300">
                    {successMessage}
                  </div>
                )}
                {errorMessage && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
                    {errorMessage}
                  </div>
                )}
              </div>
            </div>
            {/* MMR Analysis */}
            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-md flex flex-col gap-6 animate-fade-in">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-2">
                <BarChart3 className="w-5 h-5" /> MMR Analysis
              </h2>
              {calculatedMMR && (
                <div className="space-y-4">
                  {/* Estimated MMR Card (existing) */}
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg p-4 flex flex-col items-center">
                    <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-1">Estimated MMR</span>
                    <span className="text-3xl font-extrabold text-primary-900 dark:text-primary-100 tracking-tight">{calculatedMMR.rating}</span>
                    <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">RD: {calculatedMMR.rd} | Volatility: {calculatedMMR.vol}</div>
                  </div>
                  {/* NEW: Expected MMR for Rank Card */}
                  <div className={`border rounded-lg p-4 flex flex-col items-center mt-2 ${
                    ratingDiff.status === 'underranked'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                      : ratingDiff.status === 'overranked'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                      : 'bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700'
                  }`} style={{ maxWidth: 320 }}>
                    <span className={`text-xs font-semibold mb-1 ${
                      ratingDiff.status === 'underranked'
                        ? 'text-green-700 dark:text-green-300'
                        : ratingDiff.status === 'overranked'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>Expected MMR for Rank</span>
                    <span className={`text-lg font-bold ${
                      ratingDiff.status === 'underranked'
                        ? 'text-green-900 dark:text-green-100'
                        : ratingDiff.status === 'overranked'
                        ? 'text-red-900 dark:text-red-100'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {/* Use shared expected MMR calculation */}
                      {calculateExpectedMMR(playerData.currentRank, playerData.currentRP)}
                    </span>
                    <span className={`text-xs mt-1 font-medium ${
                      ratingDiff.status === 'underranked'
                        ? 'text-green-700 dark:text-green-300'
                        : ratingDiff.status === 'overranked'
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {ratingDiff.status === 'underranked'
                        ? 'You are likely to rank up quickly.'
                        : ratingDiff.status === 'overranked'
                        ? 'You may lose RP faster.'
                        : 'You are perfectly ranked.'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                      This is the system's expected MMR for your current rank and RP. If your estimated MMR is much higher, you are likely to rank up quickly. If much lower, you may lose RP faster.
                    </span>
                    {/* Nightmare survival mode warning */}
                    {playerData.currentRank === 'NIGHTMARE_1' && playerData.currentRP >= 50 && (
                      <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded text-xs text-orange-700 dark:text-orange-300 text-center">
                        <div className="font-medium mb-1">⚠️ Nightmare Survival Mode</div>
                        <div>
                          At high Nightmare levels (e.g., 2550+ RP), your RP gain per win plateaus unless you're still rising in MMR. But losses remain heavily penalized — creating a 'survival mode' dynamic where you must maintain consistency to keep rising.
                        </div>
                        {playerData.currentRP >= 80 && (
                          <div className="mt-2 p-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-red-600 dark:text-red-400">
                            <strong>Critical:</strong> At {playerData.currentRP}+ RP, every loss is devastating. Focus on consistency over aggression.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Expected RP Gain/Loss Card */}
                  <div className="bg-gradient-to-r from-green-50 to-red-50 dark:from-green-900/20 dark:to-red-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col items-center">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Expected RP Changes</span>
                    <div className="flex items-center gap-6">
                      {/* RP Gain */}
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">Gain</span>
                        <span className="text-xl font-bold text-green-900 dark:text-green-100">
                          +{calculateExpectedRPNorm(playerData.currentRank, playerData.currentRP, 'win')}
                        </span>
                        {playerData.matchHistory.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Recent: +{calculateAverageRPGain(playerData.matchHistory)}
                          </span>
                        )}
                      </div>
                      
                      {/* Divider */}
                      <div className="w-px h-12 bg-gray-300 dark:bg-gray-600"></div>
                      
                      {/* RP Loss */}
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">Loss</span>
                        <span className="text-xl font-bold text-red-900 dark:text-red-100">
                          {calculateExpectedRPNorm(playerData.currentRank, playerData.currentRP, 'loss')}
                        </span>
                        {playerData.matchHistory.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Recent: {calculateAverageRPLoss(playerData.matchHistory)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                      Norm: Expected for typical {playerData.currentRank} player at {playerData.currentRP} RP (based on expected MMR) | Recent: Your actual results
                    </span>
                    {calculatedMMR && (
                      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-center">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Personalized (Your MMR)</span>
                        <div className="flex items-center justify-center gap-4 mt-1">
                          <span className="text-sm text-green-700 dark:text-green-300">
                            +{calculateExpectedRPPersonalized(calculatedMMR.rating, playerData.currentRank, playerData.currentRP, 'win')}
                          </span>
                          <span className="text-sm text-red-700 dark:text-red-300">
                            {calculateExpectedRPPersonalized(calculatedMMR.rating, playerData.currentRank, playerData.currentRP, 'loss')}
                          </span>
                        </div>
                        <span className="text-xs text-blue-600 dark:text-blue-400 mt-1 block">
                          Prediction based on your calculated MMR ({calculatedMMR.rating > calculateExpectedMMR(playerData.currentRank, playerData.currentRP) ? 'above' : 'below'} typical) - shows what you should expect based on your skill level
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Fix accuracy score coloring: */}
                  <div className={`border rounded-lg p-4 flex flex-col items-center mt-2 ${
                    accuracyScore === 'High'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                      : accuracyScore === 'Medium'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                  }`}>
                    <span className="text-xs font-semibold mb-1">Accuracy Score</span>
                    <span className="text-lg font-bold">{accuracyScore}</span>
                    <span className="text-xs">{accuracyPercentage}%</span>
                    <div className="text-xs mt-1 text-center">
                      {accuracyPercentage < 50 && "Add more recent matches for better accuracy"}
                      {accuracyPercentage >= 50 && accuracyPercentage < 75 && "Good data quality - results are reliable"}
                      {accuracyPercentage >= 75 && "Excellent data quality - highly accurate results"}
                    </div>
                  </div>
                  {ratingDiff.status !== 'aligned' && (
                    <div className={`border rounded-lg p-3 flex flex-col items-center mt-2 ${
                      ratingDiff.status === 'underranked' 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        {ratingDiff.status === 'underranked' ? 
                          <TrendingUp className="w-4 h-4" /> : 
                          <TrendingDown className="w-4 h-4" />
                        }
                        <span className="text-sm font-medium">
                          {ratingDiff.status === 'underranked' ? 'Underranked' : 'Overranked'}
                        </span>
                      </div>
                      <div className="text-xs mt-1">
                        MMR is {Math.abs(ratingDiff.diff)} points {ratingDiff.status === 'underranked' ? 'above' : 'below'} expected
                      </div>
                      <div className="text-xs mt-1">
                        {ratingDiff.status === 'underranked'
                          ? 'You are likely to rank up quickly.'
                          : 'You may lose RP faster.'}
                      </div>
                    </div>
                  )}
                  {/* Show Nightmare warning for overranked players */}
                  {playerData.currentRank === 'NIGHTMARE_1' && ratingDiff.status === 'overranked' && Math.abs(ratingDiff.diff) > 100 && (
                    <div className="border rounded-lg p-3 flex flex-col items-center mt-2 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Nightmare Difficulty Warning</span>
                      </div>
                      <div className="text-xs mt-1 text-center">
                        ⚠️ You may gain less RP per win because the system expects higher MMR for your current Nightmare RP.
                      </div>
                      <div className="text-xs mt-1 text-center">
                        Focus on consistent wins to close the gap.
                      </div>
                    </div>
                  )}
                  {/* Show notification for perfectly ranked (aligned) */}
                  {ratingDiff.status === 'aligned' && (
                    <div className="border rounded-lg p-3 flex flex-col items-center mt-2 bg-gray-50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        <span className="text-sm font-medium">Perfectly Ranked</span>
                      </div>
                      <div className="text-xs mt-1">
                        Your MMR matches the system's expectation for your rank.
                      </div>
                      <div className="text-xs mt-1">
                        You are perfectly ranked.
                      </div>
                    </div>
                  )}
                  {shieldStatus.active && (
                    <div className={`border rounded-lg p-3 flex flex-col items-center mt-2 ${
                      shieldStatus.warning 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          Demotion Shield {shieldStatus.warning ? 'CRITICAL' : 'Active'}
                        </span>
                      </div>
                      <div className="text-xs mt-1">
                        {shieldStatus.gamesUsed}/3 shield games used
                        {shieldStatus.warning && " - demotion imminent!"}
                      </div>
                      {shieldStatus.active && (
                        <div className="text-xs mt-2 p-2 bg-white/50 dark:bg-gray-900/50 rounded">
                          ⚠️ Your MMR is still dropping during shield games, even though your RP stays at 0
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Recent Matches - now wider */}
            <div ref={recentMatchesRef} className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-md flex flex-col gap-6 animate-fade-in min-w-[320px]">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Clock className="w-5 h-5" /> Recent Matches
                </h2>
                <button
                  onClick={addMatch}
                  className="px-3 py-1 bg-primary-600 dark:bg-primary-500 text-white rounded-md hover:bg-primary-700 dark:hover:bg-primary-400 text-xs font-semibold shadow transition"
                >
                  Add Match
                </button>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">#1 being most recent to #10 being latest</p>
              <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin scrollable-section">
                {playerData.matchHistory.map((match, index) => {
                  let glowColor = '';
                  if (match.outcome === 'win') {
                    glowColor = '0 0 16px 4px rgba(16, 185, 129, 0.5)'; // dark green
                  } else if (match.outcome === 'loss') {
                    glowColor = '0 0 16px 4px rgba(220, 38, 38, 0.5)'; // dark red
                  } else if (match.outcome === 'draw') {
                    glowColor = '0 0 16px 4px rgba(251, 191, 36, 0.5)'; // dark orange/yellow
                  }
                  return (
                    <div
                      key={match.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex w-full ${
                        draggedIndex === index
                          ? 'opacity-50'
                          : dragOverIndex === index
                          ? 'transform scale-105'
                          : ''
                      }`}
                    >
                      <div
                        className={`bg-white dark:bg-gray-900 border rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-2 shadow-sm transition-all duration-200 group relative mx-auto w-[97%] ${
                          draggedIndex === index
                            ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : dragOverIndex === index
                            ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                        style={{
                          transition: 'box-shadow 0.2s',
                        }}
                        onMouseEnter={e => {
                          if (draggedIndex !== index) {
                            (e.currentTarget as HTMLDivElement).style.boxShadow = glowColor;
                          }
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1 md:mb-0">
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">#{index + 1}</span>
                          <select
                            value={match.outcome}
                            onChange={(e) => updateMatch(match.id, 'outcome', e.target.value)}
                            className="text-xs px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded focus:ring-primary-500 dark:focus:ring-primary-400"
                          >
                            <option value="win">Win</option>
                            <option value="loss">Loss</option>
                            <option value="draw">Draw</option>
                          </select>
                          {match.outcome === 'loss' && (
                            <label className="flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={match.wasShielded || false}
                                onChange={(e) => updateMatch(match.id, 'wasShielded', e.target.checked)}
                                className="w-3 h-3 accent-yellow-500"
                              />
                              <Shield className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                            </label>
                          )}
                          <button
                            onClick={() => removeMatch(match.id)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs ml-auto"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 dark:text-gray-300">RP:</span>
                          <input
                            type="number"
                            value={match.outcome === 'draw' ? 0 : (match.wasShielded ? 0 : match.rpChange)}
                            onChange={(e) => updateMatch(match.id, 'rpChange', e.target.value)}
                            className="text-xs px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded w-16 focus:ring-primary-500 dark:focus:ring-primary-400"
                            disabled={match.wasShielded || match.outcome === 'draw'}
                            min={match.outcome === 'win' ? 1 : match.outcome === 'loss' ? -99 : 0}
                            max={match.outcome === 'win' ? 99 : match.outcome === 'loss' ? -1 : 0}
                          />
                          <span className={`text-xs font-medium ${
                            match.wasShielded ? 'text-yellow-600 dark:text-yellow-400' : 
                            match.outcome === 'draw' ? 'text-blue-600 dark:text-blue-400' :
                            match.rpChange > 0 ? 'text-green-600 dark:text-green-400' : 
                            match.rpChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
                          }`}>
                            {match.wasShielded ? '🛡️ 0 (shielded)' : 
                              match.outcome === 'draw' ? '0 (draw)' :
                              match.rpChange > 0 ? '+' + match.rpChange : match.rpChange}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {playerData.matchHistory.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No matches recorded</p>
                  <p className="text-xs">Add matches to improve accuracy</p>
                </div>
              )}
            </div>
          </div>
        )}
        {mainTab === 'calculator' && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-sm animate-fade-in">
            {/* System Insights Panel (unchanged, but more spacing and modern card style) */}
            <div className="bg-primary-50 dark:bg-primary-900/20 p-6 rounded-2xl flex flex-col items-center border border-primary-100 dark:border-primary-700 shadow-md">
              <div className="font-semibold text-primary-900 dark:text-primary-100">Match Sample</div>
              <div className="text-2xl font-extrabold text-primary-700 dark:text-primary-300">{playerData.matchHistory.length}/10</div>
              <div className="text-xs text-primary-600 dark:text-primary-400">matches tracked</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl flex flex-col items-center border border-green-100 dark:border-green-700 shadow-md">
              <div className="font-semibold text-green-900 dark:text-green-100">Sample Win Rate</div>
              <div className="text-2xl font-extrabold text-green-700 dark:text-green-300">
                {playerData.matchHistory.length > 0 
                  ? Math.round((playerData.matchHistory.filter(m => m.outcome === 'win').length / playerData.matchHistory.length) * 100)
                  : 0
                }%
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">from recent matches</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl flex flex-col items-center border border-red-100 dark:border-red-700 shadow-md">
              <div className="font-semibold text-red-900 dark:text-red-100">Avg RP/Win</div>
              <div className="text-2xl font-extrabold text-red-700 dark:text-red-300">
                {playerData.matchHistory.length > 0 
                  ? Math.round(playerData.matchHistory.filter(m => m.outcome === 'win').reduce((sum, m) => sum + m.rpChange, 0) / playerData.matchHistory.filter(m => m.outcome === 'win').length) || 0
                  : 0
                }
              </div>
              <div className="text-xs text-red-600 dark:text-red-400">recent average</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-2xl flex flex-col items-center border border-yellow-100 dark:border-yellow-700 shadow-md">
              <div className="font-semibold text-yellow-900 dark:text-yellow-100">Avg RP/Loss</div>
              <div className="text-2xl font-extrabold text-yellow-700 dark:text-yellow-300">
                {playerData.matchHistory.length > 0 
                  ? Math.round(playerData.matchHistory.filter(m => m.outcome === 'loss').reduce((sum, m) => sum + m.rpChange, 0) / playerData.matchHistory.filter(m => m.outcome === 'loss').length) || 0
                  : 0
                }
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">recent average</div>
            </div>
          </div>
        )}
        {mainTab === 'advanced' && (
          <section className="advanced-prediction mt-8 p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl animate-fade-in max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
              Advanced RP Prediction
            </h2>
            {/* --- Rank Progression Summary --- */}
            <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700">
              <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Rank Progression Summary</h4>
              <div className="flex flex-wrap gap-2">
                {simulation.promotions.map((promo, index) => (
                  <span key={index} className={`px-2 py-1 rounded text-xs font-medium border ${promo.type === 'promotion' ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700'}`}>
                    Match {promo.game}: {promo.fromRank.replace('_', ' ')} → {promo.toRank.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
            {/* Simplified Input Interface */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/80 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow flex flex-col gap-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Games to Predict</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={gamesToPredict}
                    onChange={e => setGamesToPredict(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-blue-400 dark:focus:border-blue-600 transition shadow-sm text-base"
                  />
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/80 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow flex flex-col gap-3">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Expected Win Rate</label>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 ${winRateMode === 'percent' ? 'bg-blue-100 dark:bg-blue-700 border-blue-400 text-blue-800 dark:text-blue-200 shadow' : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-700 dark:text-gray-200'}`}
                      onClick={() => setWinRateMode('percent')}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 ${winRateMode === 'count' ? 'bg-blue-100 dark:bg-blue-700 border-blue-400 text-blue-800 dark:text-blue-200 shadow' : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-700 dark:text-gray-200'}`}
                      onClick={() => setWinRateMode('count')}
                    >
                      Games Won
                    </button>
                  </div>
                  {winRateMode === 'percent' ? (
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={expectedWinRate}
                      onChange={e => setExpectedWinRate(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-blue-400 dark:focus:border-blue-600 transition shadow-sm text-base"
                    />
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max={gamesToPredict}
                      value={expectedWins}
                      onChange={e => setExpectedWins(Math.max(0, Math.min(gamesToPredict, parseInt(e.target.value) || 0)))}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 focus:border-blue-400 dark:focus:border-blue-600 transition shadow-sm text-base"
                    />
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {winRateMode === 'percent'
                      ? `Based on your recent matches: ${recentWinRate}%`
                      : `Out of ${gamesToPredict} games, ${expectedWins} wins (${Math.round((expectedWins / gamesToPredict) * 100)}%)`}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button type="button" className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition" onClick={() => { setWinRateMode('percent'); setExpectedWinRate(40); }}>Conservative (40%)</button>
                    <button type="button" className="px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-700 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-600 transition" onClick={() => { setWinRateMode('percent'); setExpectedWinRate(recentWinRate); }}>Current Rate ({recentWinRate}%)</button>
                    <button type="button" className="px-3 py-1 rounded-lg bg-green-100 dark:bg-green-700 text-xs font-semibold hover:bg-green-200 dark:hover:bg-green-600 transition" onClick={() => { setWinRateMode('percent'); setExpectedWinRate(70); }}>Optimistic (70%)</button>
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
                <p><strong>Simulation uses expected MMR for all calculations:</strong> MMR is constrained to rank expectations</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">MMR progression follows rank/RP expectations, preventing unrealistic inflation.</p>
              </div>
            </div>
            {/* RP Progression Graph with Glicko overlay */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3">RP & MMR Progression Prediction</h4>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulation.data}>
                    <defs>
                      <linearGradient id="rankLineGradient" x1="0" y1="0" x2="1" y2="0">
                        {getLineGradientStops(simulation.data).map((stop, i) => (
                          <stop key={i} offset={`${stop.offset}%`} stopColor={stop.color} />
                        ))}
                      </linearGradient>
                    </defs>
                    {/* Rank background zones */}
                    {RANK_ZONES.map((zone, index) => (
                      <ReferenceArea key={`zone-${index}`} y1={zone.min} y2={zone.max} fill={zone.color} fillOpacity={0.05} />
                    ))}
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="game" label={{ value: 'Match Number', position: 'insideBottom', offset: -5, fill: '#6b7280' }} tick={{ fill: '#6b7280' }} />
                    <YAxis yAxisId="rp" dataKey="rp" label={{ value: 'RP', angle: -90, position: 'insideLeft', fill: '#6b7280' }} tickFormatter={formatYAxis} domain={['dataMin - 10', 'dataMax + 10']} tick={{ fill: '#6b7280' }} />
                    <YAxis yAxisId="glicko" orientation="right" dataKey="glicko" label={{ value: 'MMR', angle: 90, position: 'insideRight', fill: '#8B5CF6' }} tick={{ fill: '#8B5CF6' }} />
                    <RechartsTooltip content={EnhancedTooltip} />
                    {/* RP line with gradient coloring */}
                    <Line yAxisId="rp" type="monotone" dataKey="rp" stroke="url(#rankLineGradient)" strokeWidth={3} dot={<PromotionDot />} activeDot={{ r: 5 }} connectNulls={false} />
                    {/* MMR line */}
                    <Line yAxisId="glicko" type="monotone" dataKey="glicko" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                    {/* Promotion/demotion reference lines and labels */}
                    {simulation.promotions.map((promo, index) => (
                      <ReferenceLine key={`promo-${index}`} x={promo.game} stroke={promo.type === 'promotion' ? '#10B981' : '#EF4444'} strokeWidth={2} strokeDasharray="5 5" />
                    ))}
                    {simulation.promotions.map((promo, index) => (
                      <text key={`label-${index}`} x={(() => {
                        // Find the x position for the label
                        const idx = simulation.data.findIndex((d: any) => d.game === promo.game);
                        return idx !== -1 ? `${(idx * 100) / (simulation.data.length - 1)}%` : '0%';
                      })()} y={30} textAnchor="middle" fill={promo.type === 'promotion' ? '#10B981' : '#EF4444'} fontSize="10" fontWeight="bold">
                        {promo.type === 'promotion' ? '↗️' : '↘️'} {promo.toRank.replace('_', ' ')}
                      </text>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Simulation Calculation Summary */}
              <div className="mt-3 text-xs text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <strong>Simulation includes:</strong> MMR is constrained to expected values for current rank/RP (prevents inflation), RP calculations use expected MMR, rank difficulty multipliers, skill gap calculations, promotion/demotion effects, and shield mechanics. Each data point uses rank-appropriate MMR.
              </div>
            </div>
            {/* Insights/Results Display */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center border border-green-100 dark:border-green-700">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{simulation.finalRP}</div>
                <div className="text-sm text-green-600 dark:text-green-400">Final RP</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center border border-blue-100 dark:border-blue-700">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{simulation.finalRank.replace('_', ' ')}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Final Rank</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center border border-purple-100 dark:border-purple-700">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">+{simulation.promotions.length}</div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Rank Ups</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-lg text-center border border-gray-100 dark:border-gray-700">
                <div className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">RP Insights</div>
                <div className="text-sm">
                  {(() => {
                    // Calculate total RP gained by summing all rpChange values, excluding large negative changes
                    // that are likely rank-up resets (bigger than -60)
                    const totalRPGained = simulation.data.reduce((total, match) => {
                      const rpChange = match.rpChange;
                      if (rpChange > -60) {
                        return total + rpChange;
                      }
                      return total;
                    }, 0);
                    
                    return (
                      <>
                        <span className="block">Total RP gain: <span className="text-green-700 dark:text-green-400 font-semibold">{totalRPGained >= 0 ? '+' : ''}{totalRPGained}</span></span>
                        <span className="block">Avg RP per match: <span className={(totalRPGained / gamesToPredict) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>{(totalRPGained / gamesToPredict).toFixed(2)}</span></span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            {/* Skill Evolution Table */}
            <div className="mt-8">
              <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2">🧠 Skill Evolution</h4>
              <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                <div>
                  <span className="text-purple-600 dark:text-purple-400">Starting MMR:</span>
                  <span className="font-mono ml-2">{simulation.startingGlicko}</span>
                </div>
                <div>
                  <span className="text-purple-600 dark:text-purple-400">Final MMR:</span>
                  <span className="font-mono ml-2">{simulation.finalGlicko}</span>
                </div>
                <div>
                  <span className="text-purple-600 dark:text-purple-400">Skill Change:</span>
                  <span className={`font-mono ml-2 ${(simulation.finalGlicko - simulation.startingGlicko) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {(simulation.finalGlicko - simulation.startingGlicko) > 0 ? '+' : ''}{simulation.finalGlicko - simulation.startingGlicko}
                  </span>
                </div>
              </div>
            </div>
            {/* Results Table */}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full border-collapse bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm text-xs md:text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left">Game</th>
                    <th className="px-3 py-2 text-left">Result</th>
                    <th className="px-3 py-2 text-left">RP</th>
                    <th className="px-3 py-2 text-left">Rank</th>
                    <th className="px-3 py-2 text-left">MMR</th>
                    <th className="px-3 py-2 text-left">ΔRP</th>
                    <th className="px-3 py-2 text-left">Skill Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.data.map((match, index) => (
                    <tr key={index} className={`${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/60' : 'bg-white dark:bg-gray-900'} ${match.promoted ? 'border-l-4 border-green-500' : ''}`}>
                      <td className="px-3 py-2">{match.game}</td>
                      <td className={`px-3 py-2 font-medium ${match.result === 'Win' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{match.result}</td>
                      <td className="px-3 py-2">{match.rp}</td>
                      <td className="px-3 py-2">{match.rank}</td>
                      <td className="px-3 py-2 font-mono">{match.glicko}</td>
                      <td className={`px-3 py-2 font-mono font-bold ${match.rpChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{match.rpChange > 0 ? '+' : ''}{match.rpChange}</td>
                      <td className={`px-3 py-2 text-xs ${match.skillGap > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>{match.skillGap > 0 ? '+' : ''}{match.skillGap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {mainTab === 'info' && (!infoTabAdminOnly || isAdmin) && (
          <GlickoGuide />
        )}
        {mainTab === 'history' && (
          <MMRHistoryTab />
        )}
        {calculatedMMR && (mainTab === 'calculator' || mainTab === 'advanced') && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              MMR Spectrum
            </h3>
            <div className="w-full max-w-6xl mx-auto bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-lg p-6 border border-gray-200 dark:border-gray-800 relative">
              {/* Custom label for Your MMR positioned above the chart */}
              <div 
                className="absolute text-center text-xs font-bold text-purple-600 dark:text-purple-400"
                style={{
                  left: `${(compressBronzeTiers(calculatedMMR.rating) / compressBronzeTiers(Math.max(2600, calculatedMMR.rating + 100))) * 100}%`,
                  transform: 'translateX(-50%)',
                  top: '10px',
                  fontWeight: 700,
                  fontSize: 10
                }}
              >
                Your MMR: {calculatedMMR.rating}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={[{ mmr: 0 }]}> {/* Use ComposedChart for better overlay support */}
                  {/* Extended range indicator */}
                  {calculatedMMR.rating > 2600 && (
                    <ReferenceArea
                      x1={compressBronzeTiers(2600)}
                      x2={compressBronzeTiers(Math.max(2600, calculatedMMR.rating + 100))}
                      fill="#fef3c7"
                      fillOpacity={0.3}
                      stroke="none"
                    />
                  )}
                  {/* Colored bands for each rank using Area components with compressed scale */}
                  {RANK_NAMES.map((rank, i) => {
                    const start = GLICKO_RATINGS[i];
                    const end = GLICKO_RATINGS[i + 1] !== undefined ? GLICKO_RATINGS[i + 1] : Math.max(2600, calculatedMMR.rating + 100);
                    const color = RANK_COLORS[getRankBase(rank)];
                    
                    return (
                      <Area
                        key={rank}
                        dataKey="mmr"
                        fill={color}
                        fillOpacity={0.2}
                        stroke="none"
                        type="monotone"
                        data={[{ mmr: compressBronzeTiers(start) }, { mmr: compressBronzeTiers(end) }]}
                      />
                    );
                  })}
                  {/* Promotion/demotion lines and rank labels with compressed scale */}
                  {RANK_NAMES.map((rank, i) => (
                    <ReferenceLine
                      key={`line-${rank}`}
                      x={compressBronzeTiers(GLICKO_RATINGS[i])}
                      stroke="#6b7280"
                      strokeDasharray="3 3"
                    />
                  ))}
                  {/* Additional reference lines for extended range */}
                  {(() => {
                    const maxMMR = Math.max(2600, calculatedMMR.rating + 100);
                    const additionalLines = [];
                    
                    if (maxMMR > 2600) {
                      for (let i = 2600; i <= maxMMR; i += 100) {
                        additionalLines.push(
                          <ReferenceLine
                            key={`line-${i}`}
                            x={compressBronzeTiers(i)}
                            stroke="#6b7280"
                            strokeDasharray="3 3"
                            strokeOpacity={0.5}
                          />
                        );
                      }
                    }
                    
                    return additionalLines;
                  })()}
                  {/* X Axis: MMR scale with compressed ticks */}
                  <XAxis
                    type="number"
                    dataKey="mmr"
                    domain={[0, Math.max(2600, calculatedMMR.rating + 100)]} // Dynamic domain to include player's MMR
                    ticks={(() => {
                      // Generate ticks dynamically based on the domain
                      const maxMMR = Math.max(2600, calculatedMMR.rating + 100);
                      const baseTicks = [0, 500, 900, 1100, 1400, 1480, 1550, 1620, 1700, 1800, 1880, 1960, 2020, 2070, 2100, 2150, 2170, 2230, 2300, 2370, 2500];
                      
                      // Add additional ticks if player's MMR exceeds the base range
                      if (maxMMR > 2600) {
                        // Add ticks at 2600, 2700, 2800, etc. up to maxMMR
                        for (let i = 2600; i <= maxMMR; i += 100) {
                          baseTicks.push(i);
                        }
                      }
                      
                      return baseTicks.map(compressBronzeTiers);
                    })()}
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const compressedValue = payload.value;
                      const originalValue = Math.round(decompressForDisplay(compressedValue));
                      
                      // Find the rank name by matching the original value to GLICKO_RATINGS
                      let rankName = '';
                      for (let i = 0; i < RANK_NAMES.length; i++) {
                        if (GLICKO_RATINGS[i] === originalValue) {
                          rankName = RANK_NAMES[i].replace('_', ' ');
                          break;
                        }
                      }
                      
                      return (
                        <g>
                          {/* Numerical value */}
                          <text
                            x={x}
                            y={y + 15}
                            textAnchor="middle"
                            fill="#6b7280"
                            fontSize={10}
                            fontWeight={600}
                          >
                            {originalValue}
                          </text>
                          {/* Rank name - angled downward */}
                          <text
                            x={x}
                            y={y + 35}
                            textAnchor="middle"
                            fill="#6b7280"
                            fontSize={8}
                            fontWeight={500}
                            transform={`rotate(-45 ${x} ${y + 35})`}
                          >
                            {rankName}
                          </text>
                        </g>
                      );
                    }}
                    axisLine={false}
                    tickLine={false}
                    height={100}
                  />
                  <YAxis hide domain={[0, 1]} />
                  {/* User's estimated MMR marker - vertical line */}
                  <ReferenceLine
                    x={compressBronzeTiers(calculatedMMR.rating)}
                    stroke="#8B5CF6"
                    strokeWidth={3}
                  />
                  {/* Expected MMR marker - vertical line */}
                  {(() => {
                    const expectedMMR = calculateExpectedMMR(playerData.currentRank, playerData.currentRP);
                    
                    return (
                      <ReferenceLine
                        x={compressBronzeTiers(expectedMMR)}
                        stroke="#10B981"
                        strokeWidth={3}
                        label={{
                          value: `Expected: ${expectedMMR}`,
                          position: 'bottom',
                          fill: '#10B981',
                          fontWeight: 700,
                          fontSize: 10,
                          offset: 5
                        }}
                      />
                    );
                  })()}
                </ComposedChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-4 justify-center mt-4 mb-2 text-xs">
                {Object.entries(RANK_COLORS).map(([rank, color]) => (
                  <div key={rank} className="flex items-center gap-1">
                    <span style={{ width: 16, height: 8, background: color, display: 'inline-block', borderRadius: 2, opacity: 0.7 }}></span>
                    <span className="text-gray-700 dark:text-gray-300">{rank.charAt(0) + rank.slice(1).toLowerCase()}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span style={{ width: 12, height: 12, background: '#8B5CF6', borderRadius: '50%', display: 'inline-block', border: '2px solid #fff' }}></span>
                  <span className="text-gray-700 dark:text-gray-300">Your MMR</span>
                </div>
                <div className="flex items-center gap-1">
                  <span style={{ width: 12, height: 12, background: '#10B981', borderRadius: '50%', display: 'inline-block', border: '2px solid #fff' }}></span>
                  <span className="text-gray-700 dark:text-gray-300">Expected</span>
                </div>
              </div>
              {/* Short summary below the graph */}
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 text-center">
                {mmrSpectrumSummary}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Authentication Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </div>
  );
};

export default BedWarsMMRCalculator;