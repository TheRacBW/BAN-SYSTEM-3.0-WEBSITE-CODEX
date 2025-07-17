import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, Target, Award, Shield, AlertCircle, BarChart3, Clock, BarChart2 } from 'lucide-react';
import RankBadge from './leaderboard/RankBadge';
import { calculateRankFromRP, getRankDisplayName } from '../utils/rankingSystem';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as RechartsTooltip } from 'recharts';

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

  const MAIN_TABS = [
    { key: 'calculator', label: 'MMR & RP Calculator', icon: <Calculator size={18} /> },
    { key: 'advanced', label: 'Advanced RP Prediction', icon: <BarChart2 size={18} /> },
  ];
  const [mainTab, setMainTab] = useState<'calculator' | 'advanced'>('calculator');

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

  function generateSimulationData(
    games: number,
    winRate: number,
    avgRPWin: number,
    avgRPLoss: number,
    startingRP: number,
    startingRank: string,
    startingGlicko: number
  ) {
    const data = [];
    let currentRP = startingRP;
    let currentRank = startingRank;
    let currentGlicko = startingGlicko;
    let promotions = 0;
    const rankPromotions = [];
    let division = RANK_DIVISIONS[startingRank as keyof typeof RANK_DIVISIONS];
    for (let i = 1; i <= games; i++) {
      const isWin = Math.random() < (winRate / 100);
      // Always use the current Glicko for RP gain/loss calculation
      const divisionGlicko = GLICKO_RATINGS[division];
      let baseRP = isWin ? avgRPWin : avgRPLoss;
      // Diminishing returns: as Glicko increases, RP gain shrinks for wins, increases for losses
      if (isWin && currentGlicko > divisionGlicko) {
        baseRP = Math.max(1, Math.round(baseRP * (1 - (currentGlicko - divisionGlicko) / 2000)));
      }
      if (!isWin && currentGlicko < divisionGlicko) {
        baseRP = Math.min(-1, Math.round(baseRP * (1 - (divisionGlicko - currentGlicko) / 2000)));
      }
      let rpChange = baseRP;
      currentRP += rpChange;
      // Handle promotion/demotion
      const { newRP, newRank, promoted } = handleRankProgression(currentRP, currentRank);
      if (promoted) {
        promotions++;
        rankPromotions.push({ game: i, rank: newRank });
        // When promoted, RP gain/loss is further reduced (simulate harder climb)
        if (isWin) rpChange = Math.max(1, Math.round(rpChange * 0.85));
        else rpChange = Math.round(rpChange * 1.1); // Losses can be harsher after promotion
      }
      currentRP = newRP;
      currentRank = newRank;
      division = RANK_DIVISIONS[currentRank as keyof typeof RANK_DIVISIONS];
      // Glicko update (simple model)
      const expected = 0.5; // Assume even matchups for simulation
      currentGlicko += 32 * ((isWin ? 1 : 0) - expected);
      data.push({
        game: i,
        rp: Math.max(0, Math.min(99, currentRP)),
        rank: currentRank,
        glicko: Math.round(currentGlicko),
        result: isWin ? 'Win' : 'Loss',
        rpChange: rpChange,
        promoted: promoted
      });
    }
    return { data, promotions, finalRP: Math.round(currentRP), finalRank: currentRank, rankPromotions };
  }

  const simulation = generateSimulationData(
    gamesToPredict,
    expectedWinRate,
    avgRPWin,
    avgRPLoss,
    playerData.currentRP,
    playerData.currentRank,
    calculatedMMR?.rating || 1500
  );

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 flex flex-col gap-8 animate-fade-in">
      {/* Mini Header like Leaderboard/Strat Picker */}
      <div className="mb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-wide mb-1" style={{letterSpacing: '0.01em'}}>MMR Calculator</h1>
        </div>
      </div>
      {/* Main Tabs - Leaderboard style, full width, rectangle with rounded corners */}
      <div className="w-full mb-0">
        <div className="flex w-full bg-gray-100 dark:bg-gray-700 p-1 rounded-lg shadow-md">
          {MAIN_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key as 'calculator' | 'advanced')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-base font-medium transition-all duration-200 focus:outline-none ${
                mainTab === tab.key
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
      <div className="rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 p-10 animate-fade-in backdrop-blur-md">
        {mainTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-slide-up">
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
            </div>
            {/* MMR Analysis */}
            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-md flex flex-col gap-6 animate-fade-in">
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
            {/* Recent Matches */}
            <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 shadow-md flex flex-col gap-6 animate-fade-in">
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
                <p><strong>Using your averages:</strong> <span className="text-green-700 dark:text-green-400">+{avgRPWin}</span> per win, <span className="text-red-700 dark:text-red-400">{avgRPLoss}</span> per loss</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">From your recent {playerData.matchHistory.length} matches</p>
              </div>
            </div>
            {/* RP Progression Graph */}
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3">RP Progression Prediction</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={simulation.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="game" label={{ value: 'Match Number', position: 'insideBottom', offset: -5, fill: '#6b7280' }} tick={{ fill: '#6b7280' }} />
                    <YAxis dataKey="rp" label={{ value: 'RP', angle: -90, position: 'insideLeft', fill: '#6b7280' }} tick={{ fill: '#6b7280' }} />
                    <RechartsTooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const point = payload[0].payload;
                          return (
                            <div className="rounded-lg shadow-lg p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                              <div className="font-semibold mb-1">Match {label}</div>
                              <div className="flex items-center gap-2">
                                <span className={point.rpChange > 0 ? 'text-green-600 dark:text-green-400' : point.rpChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}>
                                  {point.rpChange > 0 ? `+${point.rpChange}` : point.rpChange}
                                </span>
                                <span className="ml-1">RP {point.rpChange > 0 ? 'gain' : 'loss'}</span>
                              </div>
                              <div>Result: <span className={point.result === 'Win' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>{point.result}</span></div>
                              <div>RP after match: <span className="font-mono">{point.rp}</span></div>
                              <div>Rank: <span className="font-mono">{point.rank.replace('_', ' ')}</span></div>
                              {point.promoted && <div className="text-purple-600 dark:text-purple-400 font-semibold">Rank Up!</div>}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line type="monotone" dataKey="rp" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, stroke: '#3B82F6', strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5, fill: '#3B82F6' }} />
                    {/* Add vertical lines for rank promotions */}
                    {simulation.rankPromotions.map(promotion => (
                      <ReferenceLine key={promotion.game} x={promotion.game} stroke="#10B981" strokeDasharray="5 5" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Insights/Results Display */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center border border-green-100 dark:border-green-700">
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{simulation.finalRP}</div>
                <div className="text-sm text-green-600 dark:text-green-400">Final RP</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center border border-blue-100 dark:border-blue-700">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{simulation.finalRank.replace('_', ' ')}</div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Final Rank</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center border border-purple-100 dark:border-purple-700">
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">+{simulation.promotions}</div>
                <div className="text-sm text-purple-600 dark:text-purple-400">Rank Ups</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-lg text-center border border-gray-100 dark:border-gray-700">
                <div className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">RP Insights</div>
                <div className="text-sm">
                  <span className="block">Total RP gain: <span className="text-green-700 dark:text-green-400 font-semibold">{simulation.finalRP - playerData.currentRP >= 0 ? '+' : ''}{simulation.finalRP - playerData.currentRP}</span></span>
                  <span className="block">Avg RP per match: <span className={((simulation.finalRP - playerData.currentRP) / gamesToPredict) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>{((simulation.finalRP - playerData.currentRP) / gamesToPredict).toFixed(2)}</span></span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default BedWarsMMRCalculator; 