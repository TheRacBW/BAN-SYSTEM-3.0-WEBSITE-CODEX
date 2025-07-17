import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, Target, Award, Shield, AlertCircle, BarChart3, Clock } from 'lucide-react';
import RankBadge from './leaderboard/RankBadge';
import { calculateRankFromRP, getRankDisplayName } from '../utils/rankingSystem';

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
  const filtered = history.filter(m => m.outcome === outcome);
  if (filtered.length === 0) return '';
  return Math.round(filtered.reduce((sum, m) => sum + m.rpChange, 0) / filtered.length);
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

// --- Simulation Engine for RP Progression ---
function simulateRPProgression({
  games,
  winRate,
  avgRPWin,
  avgRPLoss,
  startRP,
  startRank,
  startGlicko,
  kFactor = 32,
  rankDivisions = RANK_DIVISIONS,
  glickoRatings = GLICKO_RATINGS,
  rankNames = RANK_NAMES
}: {
  games: number;
  winRate: number;
  avgRPWin: number;
  avgRPLoss: number;
  startRP: number;
  startRank: string;
  startGlicko: number;
  kFactor?: number;
  rankDivisions?: typeof RANK_DIVISIONS;
  glickoRatings?: typeof GLICKO_RATINGS;
  rankNames?: string[];
}) {
  let rp = startRP;
  let glicko = startGlicko;
  let division = rankDivisions[startRank as keyof typeof rankDivisions];
  let history = [];
  let rank = startRank;
  let promotions = 0;
  let demotions = 0;
  for (let i = 0; i < games; i++) {
    const win = Math.random() < winRate;
    let rpChange = win ? avgRPWin : avgRPLoss;
    // Diminishing returns: as Glicko increases, RP gain shrinks
    if (win && glicko > glickoRatings[division]) {
      rpChange = Math.max(1, Math.round(rpChange * (1 - (glicko - glickoRatings[division]) / 2000)));
    }
    if (!win && glicko < glickoRatings[division]) {
      rpChange = Math.min(-1, Math.round(rpChange * (1 - (glickoRatings[division] - glicko) / 2000)));
    }
    rp += rpChange;
    // Promotion
    if (rp >= 100) {
      rp -= 100;
      division = Math.min(division + 1, rankNames.length - 1);
      rank = rankNames[division];
      promotions++;
    }
    // Demotion
    if (rp < 0) {
      rp += 100;
      division = Math.max(division - 1, 0);
      rank = rankNames[division];
      demotions++;
    }
    // Glicko update (simple model)
    const expected = 0.5; // Assume even matchups for simulation
    glicko += kFactor * ((win ? 1 : 0) - expected);
    history.push({
      game: i + 1,
      win,
      rp: Math.max(0, Math.min(99, rp)),
      rank,
      glicko: Math.round(glicko),
      rpChange
    });
  }
  return { finalRP: Math.max(0, Math.min(99, rp)), finalRank: rank, finalGlicko: Math.round(glicko), promotions, demotions, history };
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

  // --- Advanced RP Prediction Section ---
  const [predictionTab, setPredictionTab] = useState('win'); // Default to Win-based
  const [simGames, setSimGames] = useState(10); // Default to 10 games
  const [avgRPWin, setAvgRPWin] = useState<number>(0);
  const [avgRPLoss, setAvgRPLoss] = useState<number>(0);

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

  // Calculate MMR using Glicko-2 inspired algorithm
  const calculateMMR = (data: PlayerData): GlickoRating => {
    const currentDivision = RANK_DIVISIONS[data.currentRank as keyof typeof RANK_DIVISIONS];
    const currentGlicko = GLICKO_RATINGS[currentDivision];
    const nextGlicko = GLICKO_RATINGS[currentDivision + 1] !== undefined ? GLICKO_RATINGS[currentDivision + 1] : currentGlicko;
    const rpProgress = Math.max(0, Math.min(1, data.currentRP / 100));
    // Interpolate Glicko between current and next division
    let rating = currentGlicko + (nextGlicko - currentGlicko) * rpProgress;
    let rd = data.isNewSeason ? 2.5 : 1.8;
    let vol = data.previousSeasonMMR ? 0.06 : 0.08;

    if (data.previousSeasonMMR && data.isNewSeason) {
      rating = (data.previousSeasonMMR + rating) / 2;
      rd = 2.2;
    }

    data.matchHistory.forEach(match => {
      // Use interpolated Glicko for match calculations
      const actualOutcome = match.outcome;
      const expectedRP = estimateExpectedRPChange(rating, match.wasShielded ? -12 : match.rpChange, actualOutcome);
      const surprise = Math.abs((match.wasShielded ? -12 : match.rpChange) - expectedRP) / 20;

      if (actualOutcome === 'win') {
        rating += Math.max(5, match.rpChange * 0.8);
      } else if (actualOutcome === 'loss') {
        const mmrDrop = match.wasShielded ? -12 : match.rpChange;
        rating += Math.min(-5, mmrDrop * 0.8);
      } else {
        rating += match.rpChange * 0.5;
      }

      rd = Math.max(0.8, rd - 0.05 + surprise * 0.1);
      vol = Math.max(0.04, vol + surprise * 0.005);
    });

    return { rating: Math.round(rating), rd: Math.round(rd * 100) / 100, vol: Math.round(vol * 1000) / 1000 };
  };

  const estimateExpectedRPChange = (rating: number, actualChange: number, outcome: string): number => {
    const baseChange = outcome === 'win' ? 15 : outcome === 'loss' ? -12 : 2;
    const difficultyMultiplier = Math.max(0.5, Math.min(2.0, 1800 / rating));
    return Math.round(baseChange * difficultyMultiplier);
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

  // --- Fix RP Gain Projection ---
  const projectRPGains = (mmr: GlickoRating): number => {
    const currentDivision = RANK_DIVISIONS[playerData.currentRank as keyof typeof RANK_DIVISIONS];
    const currentGlicko = GLICKO_RATINGS[currentDivision];
    const nextGlicko = GLICKO_RATINGS[currentDivision + 1] !== undefined ? GLICKO_RATINGS[currentDivision + 1] : currentGlicko;
    const rpProgress = Math.max(0, Math.min(1, playerData.currentRP / 100));
    // Interpolated expected Glicko for this RP
    const expectedGlicko = currentGlicko + (nextGlicko - currentGlicko) * rpProgress;
    const ratingDiff = mmr.rating - expectedGlicko;
    // Use a more realistic RP gain formula based on rating difference
    let baseGain = 15;
    if (ratingDiff > 100) return Math.round(baseGain * 1.3);
    if (ratingDiff > 50) return Math.round(baseGain * 1.15);
    if (ratingDiff < -100) return Math.round(baseGain * 0.7);
    if (ratingDiff < -50) return Math.round(baseGain * 0.85);
    return baseGain;
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

  useEffect(() => {
    const mmr = calculateMMR(playerData);
    setCalculatedMMR(mmr);
    setProjectedRP(projectRPGains(mmr));
    
    const accuracy = calculateAccuracy(playerData);
    setAccuracyScore(accuracy.score);
    setAccuracyPercentage(accuracy.percentage);
    
    const shield = calculateShieldStatus(playerData);
    setShieldStatus(shield);
    setDemotionShieldActive(shield.active);
  }, [playerData]);

  const addMatch = () => {
    const newMatch: MatchData = {
      id: (playerData.matchHistory.length + 1).toString(),
      outcome: 'win',
      rpChange: 15,
      wasShielded: false
    };
    
    setPlayerData(prev => ({
      ...prev,
      matchHistory: [newMatch, ...prev.matchHistory.slice(0, 9)]
    }));
  };

  const updateMatch = (id: string, field: keyof MatchData, value: any) => {
    setPlayerData(prev => ({
      ...prev,
      matchHistory: prev.matchHistory.map(match =>
        match.id === id ? { ...match, [field]: value } : match
      )
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
    
    const currentDivision = RANK_DIVISIONS[playerData.currentRank as keyof typeof RANK_DIVISIONS];
    const currentGlicko = GLICKO_RATINGS[currentDivision];
    const nextGlicko = GLICKO_RATINGS[currentDivision + 1] !== undefined ? GLICKO_RATINGS[currentDivision + 1] : currentGlicko;
    const rpProgress = Math.max(0, Math.min(1, playerData.currentRP / 100));
    const expectedGlicko = currentGlicko + (nextGlicko - currentGlicko) * rpProgress;
    const diff = calculatedMMR.rating - expectedGlicko;
    
    if (diff > 50) return { diff, status: 'underranked' };
    if (diff < -50) return { diff, status: 'overranked' };
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
  const simResult = simulateRPProgression({
    games: simGames,
    winRate,
    avgRPWin: usedAvgWin,
    avgRPLoss: usedAvgLoss,
    startRP: playerData.currentRP,
    startRank: playerData.currentRank,
    startGlicko: playerGlicko,
    kFactor,
    rankDivisions: RANK_DIVISIONS,
    glickoRatings: GLICKO_RATINGS,
    rankNames: RANK_NAMES
  });
  // --- Confidence Calculation ---
  let confidence = 'Medium';
  if (playerData.matchHistory.length >= 8) confidence = 'High';
  else if (playerData.matchHistory.length <= 2) confidence = 'Low';
  if (symmetryWarning) confidence = 'Low';

  return (
    <div className="max-w-5xl mx-auto py-8 px-2">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 md:p-10 mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <Calculator className="w-9 h-9 text-primary-600 dark:text-primary-400" />
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">BedWars MMR & RP Calculator</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Player Info Input */}
          <div className="space-y-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
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
          </div>
          {/* MMR Results */}
          <div className="space-y-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5" /> MMR Analysis
            </h2>
            {calculatedMMR && (
              <div className="space-y-4">
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg p-4 flex flex-col items-center">
                  <span className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-1">Estimated Glicko</span>
                  <span className="text-3xl font-extrabold text-primary-900 dark:text-primary-100 tracking-tight">{calculatedMMR.rating}</span>
                  <div className="text-xs text-primary-600 dark:text-primary-400 mt-1">RD: {calculatedMMR.rd} | Volatility: {calculatedMMR.vol}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex flex-col items-center">
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Current RP</span>
                  <span className="text-2xl font-bold text-green-900 dark:text-green-100">{playerData.currentRP}</span>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex flex-col items-center">
                  <span className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Expected RP Gain</span>
                  <span className="text-2xl font-bold text-green-900 dark:text-green-100">+{projectedRP}</span>
                </div>
                <div className={`border rounded-lg p-4 flex flex-col items-center ${getAccuracyColor(accuracyScore)}`}>
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
                      Glicko is {Math.abs(ratingDiff.diff)} points {ratingDiff.status === 'underranked' ? 'above' : 'below'} expected
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
                        ⚠️ Your Glicko is still dropping during shield games, even though your RP stays at 0
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Advanced RP Prediction Section */}
          <div className="mt-10 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-6 md:p-10">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              Advanced RP Prediction
            </h2>
            <div className="mb-4 flex gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setPredictionTab(tab.key)}
                  className={`px-4 py-2 rounded-t-lg font-semibold transition border-b-2 ${predictionTab === tab.key ? 'border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20 text-primary-900 dark:text-primary-100' : 'border-transparent bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Games to simulate
                    <Tooltip text="How many future games to predict using your win/loss pattern and Glicko-2 math." >
                      <span className="ml-1 text-primary-500">?</span>
                    </Tooltip>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={simGames}
                    onChange={e => setSimGames(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-32 p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                  />
                </div>
                {predictionTab === 'win' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Average RP per Win
                      <Tooltip text="Your recent average RP gain per win. Used to estimate opponent skill and predict loss RP using Glicko-2 relationships." >
                        <span className="ml-1 text-primary-500">?</span>
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={avgRPWin}
                      onChange={e => setAvgRPWin(parseInt(e.target.value) || 0)}
                      className="w-32 p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                      placeholder={String(getAvgRP(playerData.matchHistory, 'win')) || 'Auto'}
                    />
                  </div>
                )}
                {predictionTab === 'loss' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      Average RP per Loss
                      <Tooltip text="Your recent average RP loss per defeat. Used to estimate opponent skill and predict win RP using Glicko-2 relationships." >
                        <span className="ml-1 text-primary-500">?</span>
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={avgRPLoss}
                      onChange={e => setAvgRPLoss(parseInt(e.target.value) || 0)}
                      className="w-32 p-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 transition"
                      placeholder={String(getAvgRP(playerData.matchHistory, 'loss')) || 'Auto'}
                    />
                  </div>
                )}
                {predictionTab === 'auto' && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Using your match history to auto-calculate win/loss RP averages and simulate progression.
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                  <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Prediction Results</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                    {predictionTab === 'win' && usedAvgWin && (
                      <div>
                        <div>Input Win RP: <span className="font-bold">+{usedAvgWin}</span></div>
                        <div>Predicted Loss RP: <span className="font-bold">{predictedLoss !== null ? predictedLoss : 'N/A'}</span></div>
                      </div>
                    )}
                    {predictionTab === 'loss' && usedAvgLoss && (
                      <div>
                        <div>Input Loss RP: <span className="font-bold">{usedAvgLoss}</span></div>
                        <div>Predicted Win RP: <span className="font-bold">+{predictedWin !== null ? predictedWin : 'N/A'}</span></div>
                      </div>
                    )}
                    {predictionTab === 'auto' && (
                      <div>
                        <div>Avg Win RP: <span className="font-bold">+{usedAvgWin}</span></div>
                        <div>Avg Loss RP: <span className="font-bold">{usedAvgLoss}</span></div>
                        <div>Predicted Loss RP: <span className="font-bold">{predictedLoss !== null ? predictedLoss : 'N/A'}</span></div>
                        <div>Predicted Win RP: <span className="font-bold">+{predictedWin !== null ? predictedWin : 'N/A'}</span></div>
                      </div>
                    )}
                    {opponentSkill && (
                      <div>Opponent Skill Estimate: <span className="font-bold">{opponentSkill} Glicko</span></div>
                    )}
                    {symmetryWarning && (
                      <div className="text-red-600 dark:text-red-400 font-semibold">{symmetryWarning}</div>
                    )}
                    {!usedAvgWin && !usedAvgLoss && (
                      <span className="italic text-gray-400">Prediction results will appear here as you enter data.</span>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
                    Simulation Results
                    <Tooltip text="Simulates your RP and Glicko progression over the next N games, including promotions and demotions, using your win/loss pattern and Glicko-2 math."><span className="ml-1 text-primary-500">?</span></Tooltip>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                    Assumes 50% win rate for demonstration. (Custom win rate coming soon!)
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded p-3 mb-2">
                    <div>Final RP: <span className="font-bold">{simResult.finalRP}</span></div>
                    <div>Final Rank: <span className="font-bold">{simResult.finalRank.replace('_', ' ')}</span></div>
                    <div>Final Glicko: <span className="font-bold">{simResult.finalGlicko}</span></div>
                    <div>Promotions: <span className="font-bold">{simResult.promotions}</span> | Demotions: <span className="font-bold">{simResult.demotions}</span></div>
                  </div>
                  <div className="overflow-x-auto max-h-40">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                          <th className="px-2 py-1">Game</th>
                          <th className="px-2 py-1">Result</th>
                          <th className="px-2 py-1">RP</th>
                          <th className="px-2 py-1">Rank</th>
                          <th className="px-2 py-1">Glicko</th>
                          <th className="px-2 py-1">ΔRP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.history.map(row => (
                          <tr key={row.game} className="even:bg-gray-50 dark:even:bg-gray-900">
                            <td className="px-2 py-1 text-center">{row.game}</td>
                            <td className="px-2 py-1 text-center">{row.win ? 'Win' : 'Loss'}</td>
                            <td className="px-2 py-1 text-center">{row.rp}</td>
                            <td className="px-2 py-1 text-center">{row.rank.replace('_', ' ')}</td>
                            <td className="px-2 py-1 text-center">{row.glicko}</td>
                            <td className="px-2 py-1 text-center">{row.rpChange > 0 ? '+' : ''}{row.rpChange}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 items-center">
                  <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded p-2 text-xs">
                    Prediction Confidence: <span className="font-bold">{confidence}</span>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-2 text-xs">
                    RP Symmetry Check: <span className="font-bold">{symmetry.warning ? '⚠️ ' + symmetry.warning : 'OK'}</span>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-2 text-xs">
                    Opponent Skill Estimate: <span className="font-bold">{opponentSkill ? opponentSkill + ' Glicko' : 'N/A'}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  <Tooltip text="Glicko-2 is a rating system that predicts your expected win/loss RP based on your skill and your opponent's skill. This tool uses those relationships for advanced predictions.">
                    <span className="underline cursor-help">What is Glicko-2?</span>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
          {/* Match History */}
          <div className="space-y-6 bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
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
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin scrollable-section">
              {playerData.matchHistory.map((match, index) => (
                <div key={match.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-2 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-2 mb-1 md:mb-0">
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
                      value={match.wasShielded ? 0 : match.rpChange}
                      onChange={(e) => updateMatch(match.id, 'rpChange', parseInt(e.target.value) || 0)}
                      className="text-xs px-2 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded w-16 focus:ring-primary-500 dark:focus:ring-primary-400"
                      disabled={match.wasShielded}
                    />
                    <span className={`text-xs font-medium ${
                      match.wasShielded ? 'text-yellow-600 dark:text-yellow-400' : 
                      match.rpChange > 0 ? 'text-green-600 dark:text-green-400' : 
                      match.rpChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                      {match.wasShielded ? '🛡️ 0 (shielded)' : 
                       match.rpChange > 0 ? '+' + match.rpChange : match.rpChange}
                    </span>
                  </div>
                </div>
              ))}
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
        {/* Additional Insights */}
        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
          <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg flex flex-col items-center border border-primary-100 dark:border-primary-700">
            <div className="font-semibold text-primary-900 dark:text-primary-100">Match Sample</div>
            <div className="text-2xl font-extrabold text-primary-700 dark:text-primary-300">{playerData.matchHistory.length}/10</div>
            <div className="text-xs text-primary-600 dark:text-primary-400">matches tracked</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex flex-col items-center border border-green-100 dark:border-green-700">
            <div className="font-semibold text-green-900 dark:text-green-100">Sample Win Rate</div>
            <div className="text-2xl font-extrabold text-green-700 dark:text-green-300">
              {playerData.matchHistory.length > 0 
                ? Math.round((playerData.matchHistory.filter(m => m.outcome === 'win').length / playerData.matchHistory.length) * 100)
                : 0
              }%
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">from recent matches</div>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex flex-col items-center border border-red-100 dark:border-red-700">
            <div className="font-semibold text-red-900 dark:text-red-100">Avg RP/Win</div>
            <div className="text-2xl font-extrabold text-red-700 dark:text-red-300">
              {playerData.matchHistory.length > 0 
                ? Math.round(playerData.matchHistory.filter(m => m.outcome === 'win').reduce((sum, m) => sum + m.rpChange, 0) / playerData.matchHistory.filter(m => m.outcome === 'win').length) || 0
                : 0
              }
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">recent average</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg flex flex-col items-center border border-yellow-100 dark:border-yellow-700">
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
      </div>
    </div>
  );
};

export default BedWarsMMRCalculator; 