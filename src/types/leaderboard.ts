export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Emerald' | 'Nightmare';

export interface CalculatedRank {
  rank_tier: RankTier;
  rank_number: number;
  display_rp: number;
}

export interface LeaderboardEntry {
  id?: string;
  username: string;
  rank_position: number;
  rp: number; // Legacy field - use total_rp instead
  rank_title: string; // Legacy field - use calculated_rank_tier instead
  inserted_at: string;
  profile_picture?: string | null;
  user_id?: number | null;
  
  // New calculated fields
  calculated_rank_tier?: RankTier;
  calculated_rank_number?: number;
  display_rp?: number; // RP within current tier (0-99)
  total_rp?: number; // Total RP across all tiers
}

export interface RPChange {
  id?: string;
  username: string;
  previous_rp: number;
  new_rp: number;
  rp_change: number;
  previous_rank: number;
  new_rank: number;
  rank_change: number;
  change_timestamp: string;
  
  // New calculated rank change fields
  previous_calculated_rank?: string;
  new_calculated_rank?: string;
  rank_tier_change?: number;
}

export interface LeaderboardStats {
  username: string;
  total_gain?: number;
  total_loss?: number;
  profile_picture?: string | null;
  user_id?: number | null;
  
  // New calculated fields
  calculated_rank_tier?: RankTier;
  calculated_rank_number?: number;
  display_rp?: number;
  total_rp?: number;
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

// Rank tier configuration
export const RANK_TIERS: Record<RankTier, { minRp: number; maxRp: number; color: string; emoji: string }> = {
  Bronze: { minRp: 0, maxRp: 399, color: '#CD7F32', emoji: '🥉' },
  Silver: { minRp: 400, maxRp: 799, color: '#C0C0C0', emoji: '🥈' },
  Gold: { minRp: 800, maxRp: 1199, color: '#FFD700', emoji: '🥇' },
  Platinum: { minRp: 1200, maxRp: 1599, color: '#E5E4E2', emoji: '💎' },
  Diamond: { minRp: 1600, maxRp: 1899, color: '#B9F2FF', emoji: '💎' },
  Emerald: { minRp: 1900, maxRp: 1999, color: '#50C878', emoji: '💚' },
  Nightmare: { minRp: 2000, maxRp: Infinity, color: '#8B0000', emoji: '👹' }
};

// Rank tier index for sorting
export const RANK_TIER_INDEX: Record<RankTier, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
  Emerald: 6,
  Nightmare: 7
};

// Utility functions for rank calculations
export const calculateRankFromRP = (totalRp: number): CalculatedRank => {
  if (totalRp < 0) totalRp = 0;
  
  if (totalRp >= 2000) {
    return {
      rank_tier: 'Nightmare',
      rank_number: 0,
      display_rp: totalRp - 2000
    };
  } else if (totalRp >= 1900) {
    return {
      rank_tier: 'Emerald',
      rank_number: 0,
      display_rp: totalRp - 1900
    };
  } else if (totalRp >= 1600) {
    const diamondTier = Math.min(Math.floor((totalRp - 1600) / 100) + 1, 3);
    return {
      rank_tier: 'Diamond',
      rank_number: diamondTier,
      display_rp: totalRp - (1600 + (diamondTier - 1) * 100)
    };
  } else if (totalRp >= 1200) {
    const platinumTier = Math.min(Math.floor((totalRp - 1200) / 100) + 1, 4);
    return {
      rank_tier: 'Platinum',
      rank_number: platinumTier,
      display_rp: totalRp - (1200 + (platinumTier - 1) * 100)
    };
  } else if (totalRp >= 800) {
    const goldTier = Math.min(Math.floor((totalRp - 800) / 100) + 1, 4);
    return {
      rank_tier: 'Gold',
      rank_number: goldTier,
      display_rp: totalRp - (800 + (goldTier - 1) * 100)
    };
  } else if (totalRp >= 400) {
    const silverTier = Math.min(Math.floor((totalRp - 400) / 100) + 1, 4);
    return {
      rank_tier: 'Silver',
      rank_number: silverTier,
      display_rp: totalRp - (400 + (silverTier - 1) * 100)
    };
  } else {
    const bronzeTier = Math.min(Math.floor(totalRp / 100) + 1, 4);
    return {
      rank_tier: 'Bronze',
      rank_number: bronzeTier,
      display_rp: totalRp - ((bronzeTier - 1) * 100)
    };
  }
};

export const getRankDisplayName = (rankTier: RankTier, rankNumber: number): string => {
  if (rankTier === 'Emerald' || rankTier === 'Nightmare') {
    return rankTier;
  }
  return `${rankTier} ${rankNumber}`;
};

export const getRankTierColor = (rankTier: RankTier): string => {
  return RANK_TIERS[rankTier].color;
};

export const getRankTierEmoji = (rankTier: RankTier): string => {
  return RANK_TIERS[rankTier].emoji;
};

export const getRankTierIndex = (rankTier: RankTier, rankNumber: number): number => {
  const baseIndex = RANK_TIER_INDEX[rankTier] * 1000;
  return baseIndex + rankNumber;
};

export const getProgressToNextTier = (displayRp: number): number => {
  return Math.min((displayRp / 100) * 100, 100);
}; 