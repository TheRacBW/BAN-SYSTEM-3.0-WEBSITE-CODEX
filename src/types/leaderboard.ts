import { RankTier, CalculatedRank } from '../utils/rankingSystem';

// Raw data structure from simplified Roblox script
export interface RawLeaderboardEntry {
  id?: string;
  username: string;
  rank_position: number;
  rp: number; // Raw RP value from game (total RP)
  rank_title: string; // Raw rank title from game (may not match our 21-tier system)
  inserted_at: string;
  profile_picture?: string | null;
  user_id?: number | null;
}

// Enhanced entry with calculated ranks (for backward compatibility)
export interface LeaderboardEntry extends RawLeaderboardEntry {
  // Legacy calculated fields (may be present in existing data)
  calculated_rank_tier?: RankTier;
  calculated_rank_number?: number;
  display_rp?: number;
  total_rp?: number;
  
  // New frontend-calculated fields
  calculatedRank?: CalculatedRank | null;
}

export interface RPChange {
  id?: string;
  username: string;
  previous_rp: number;
  new_rp: number;
  rp_change: number;
  previous_rank_title: string; // RAW from game data
  new_rank_title: string;      // RAW from game data
  rank_position_change: number;
}

export interface LeaderboardStats {
  username: string;
  total_gain?: number;
  total_loss?: number;
  profile_picture?: string | null;
  user_id?: number | null;
  
  // Legacy calculated fields
  calculated_rank_tier?: RankTier;
  calculated_rank_number?: number;
  display_rp?: number;
  total_rp?: number;
  
  // New frontend-calculated fields
  calculatedRank?: CalculatedRank | null;
}

export interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
}

export interface RobloxThumbnail {
  targetId: number;
  state: string;
  imageUrl: string;
}

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  hottestGainers: LeaderboardStats[];
  biggestLosers: LeaderboardStats[];
  lastUpdate: string;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  activeTab: 'main' | 'gainers' | 'losers';
}

export type TabType = 'main' | 'gainers' | 'losers';

// Legacy rank tier configuration (kept for backward compatibility)
export const RANK_TIERS: Record<RankTier, { minRp: number; maxRp: number; color: string; emoji: string }> = {
  Bronze: { minRp: 0, maxRp: 399, color: '#CD7F32', emoji: '🥉' },
  Silver: { minRp: 400, maxRp: 799, color: '#C0C0C0', emoji: '🥈' },
  Gold: { minRp: 800, maxRp: 1199, color: '#FFD700', emoji: '🥇' },
  Platinum: { minRp: 1200, maxRp: 1599, color: '#E5E4E2', emoji: '💎' },
  Diamond: { minRp: 1600, maxRp: 1899, color: '#B9F2FF', emoji: '💎' },
  Emerald: { minRp: 1900, maxRp: 1999, color: '#50C878', emoji: '💚' },
  Nightmare: { minRp: 2000, maxRp: Infinity, color: '#8B0000', emoji: '👹' }
};

// Legacy rank tier index (kept for backward compatibility)
export const RANK_TIER_INDEX: Record<RankTier, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
  Emerald: 6,
  Nightmare: 7
};

// Legacy utility functions (kept for backward compatibility)
export const calculateRankFromRP = (totalRp: number): CalculatedRank => {
  // Import and use the new utility function
  const { calculateRankFromRPCached } = require('../utils/rankingSystem');
  return calculateRankFromRPCached(totalRp);
};

export const getRankDisplayName = (rankTier: RankTier, rankNumber: number): string => {
  const { getRankDisplayName: getDisplayName } = require('../utils/rankingSystem');
  return getDisplayName(rankTier, rankNumber);
};

export const getRankTierColor = (rankTier: RankTier): string => {
  const { getRankTierInfo } = require('../utils/rankingSystem');
  return getRankTierInfo(rankTier).color;
};

export const getRankTierEmoji = (rankTier: RankTier): string => {
  const { getRankTierInfo } = require('../utils/rankingSystem');
  return getRankTierInfo(rankTier).emoji;
};

export const getRankTierIndex = (rankTier: RankTier, rankNumber: number): number => {
  const { getRankTierIndex: getTierIndex } = require('../utils/rankingSystem');
  return getTierIndex(rankTier, rankNumber);
};

export const getProgressToNextTier = (displayRp: number): number => {
  const { getProgressToNextTier: getProgress } = require('../utils/rankingSystem');
  return getProgress(displayRp);
};

export interface LeaderboardEntryWithChanges extends LeaderboardEntry {
  rp_change: number; // +15 or -8
  position_change: number; // +3 or -2
  rank_title_change: string | null; // e.g. "Diamond 3 → Diamond 2" or null
  has_changes: boolean;
  previous_position?: number;
  previous_rp?: number;
  previous_rank_title?: string;
}

export type TimeRange = '6h' | '12h' | '1d' | '2d';

export interface RPChangeWithTimeRange {
  username: string;
  current_rp: number;
  current_rank_title: string;
  previous_rp: number;
  previous_rank_title: string;
  rp_change: number;
  rank_change_direction: 'up' | 'down' | 'same';
  time_period: TimeRange;
  percentage_change: number;
  profile_picture?: string | null;
  user_id?: number | null;
  inserted_at?: string;
  rank_change_text?: string;
  change_count?: number;
  latest_change?: string;
}

export interface RPChangeEntry {
  id: string;
  username: string;
  previous_rp: number;
  new_rp: number;
  rp_change: number;
  previous_rank: number;
  new_rank: number;
  previous_calculated_rank: string;
  new_calculated_rank: string;
  change_timestamp: string;
  rank_tier_change?: number;
}

export interface PlayerStats {
  totalGames: number;
  totalRPGained: number;
  highestRP: number;
  currentRank: string;
  promotions: number;
  avgRPPerGame: number;
  winRate: number;
}

export interface PlayerHistoryModalProps {
  username: string;
  isVisible: boolean;
  onClose: () => void;
} 