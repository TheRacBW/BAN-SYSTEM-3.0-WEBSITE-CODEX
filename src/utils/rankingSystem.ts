// =====================================================
// 21-Tier Ranking System - Frontend Calculations
// =====================================================

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Emerald' | 'Nightmare';

export interface CalculatedRank {
  tier: RankTier;
  level: number;
  displayRP: number;
  totalRP: number;
  calculatedRank: string;
  tierIndex: number;
}

export interface RankTierInfo {
  color: string;
  emoji: string;
  bgColor: string;
  gradient: string;
  glow: string;
}

// Rank tier configuration
export const RANK_TIERS: Record<RankTier, { minRp: number; maxRp: number; levels: number }> = {
  Bronze: { minRp: 0, maxRp: 399, levels: 4 },
  Silver: { minRp: 400, maxRp: 799, levels: 4 },
  Gold: { minRp: 800, maxRp: 1199, levels: 4 },
  Platinum: { minRp: 1200, maxRp: 1599, levels: 4 },
  Diamond: { minRp: 1600, maxRp: 1899, levels: 3 },
  Emerald: { minRp: 1900, maxRp: 1999, levels: 1 },
  Nightmare: { minRp: 2000, maxRp: Infinity, levels: 1 }
};

// Rank tier index for sorting (higher = better)
export const RANK_TIER_INDEX: Record<RankTier, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
  Emerald: 6,
  Nightmare: 7
};

/**
 * Calculate rank from total RP
 * @param totalRP - Raw RP value from game
 * @returns Calculated rank information
 */
export function calculateRankFromRP(totalRP: number): CalculatedRank {
  // Handle negative RP
  if (totalRP < 0) {
    totalRP = 0;
  }

  // Find the appropriate tier
  for (const [tierName, tierConfig] of Object.entries(RANK_TIERS)) {
    const tier = tierName as RankTier;
    
    if (totalRP >= tierConfig.minRp && totalRP <= tierConfig.maxRp) {
      let level = 0;
      let displayRP = totalRP - tierConfig.minRp;
      
      // Calculate level and display RP
      if (tier === 'Emerald' || tier === 'Nightmare') {
        // Special tiers with no sub-levels
        level = 0;
        displayRP = totalRP - tierConfig.minRp;
      } else {
        // Regular tiers with sub-levels
        level = Math.floor(displayRP / 100) + 1;
        if (level > tierConfig.levels) {
          level = tierConfig.levels;
        }
        displayRP = displayRP - ((level - 1) * 100);
      }
      
      // Ensure display RP is within bounds
      if (displayRP > 99) {
        displayRP = 99;
      }
      
      const calculatedRank = getRankDisplayName(tier, level);
      const tierIndex = getRankTierIndex(tier, level);
      
      return {
        tier,
        level,
        displayRP,
        totalRP,
        calculatedRank,
        tierIndex
      };
    }
  }
  
  // Fallback to Bronze 1 (should never reach here)
  return {
    tier: 'Bronze',
    level: 1,
    displayRP: Math.min(totalRP, 99),
    totalRP,
    calculatedRank: 'Bronze 1',
    tierIndex: getRankTierIndex('Bronze', 1)
  };
}

/**
 * Get rank tier information (colors, emojis, styling)
 * @param tier - Rank tier name
 * @returns Tier styling information
 */
export function getRankTierInfo(tier: RankTier): RankTierInfo {
  const tierInfo: Record<RankTier, RankTierInfo> = {
    Bronze: {
      color: '#CD7F32',
      emoji: '🥉',
      bgColor: '#FEF3C7',
      gradient: 'from-amber-600 to-amber-800',
      glow: 'shadow-amber-500/30'
    },
    Silver: {
      color: '#C0C0C0',
      emoji: '🥈',
      bgColor: '#F3F4F6',
      gradient: 'from-gray-400 to-gray-600',
      glow: 'shadow-gray-400/30'
    },
    Gold: {
      color: '#FFD700',
      emoji: '🥇',
      bgColor: '#FEFCE8',
      gradient: 'from-yellow-400 to-yellow-600',
      glow: 'shadow-yellow-400/50'
    },
    Platinum: {
      color: '#E5E4E2',
      emoji: '💎',
      bgColor: '#F9FAFB',
      gradient: 'from-gray-200 to-gray-400',
      glow: 'shadow-gray-300/30'
    },
    Diamond: {
      color: '#B9F2FF',
      emoji: '💎',
      bgColor: '#F0FDFF',
      gradient: 'from-cyan-300 to-cyan-500',
      glow: 'shadow-cyan-400/50'
    },
    Emerald: {
      color: '#50C878',
      emoji: '💚',
      bgColor: '#F0FDF4',
      gradient: 'from-green-400 to-green-600',
      glow: 'shadow-green-400/50'
    },
    Nightmare: {
      color: '#8B0000',
      emoji: '👹',
      bgColor: '#FEF2F2',
      gradient: 'from-red-800 to-red-900',
      glow: 'shadow-red-600/50'
    }
  };
  
  return tierInfo[tier];
}

/**
 * Get display name for rank
 * @param tier - Rank tier
 * @param level - Rank level
 * @returns Formatted rank name
 */
export function getRankDisplayName(tier: RankTier, level: number): string {
  if (tier === 'Emerald' || tier === 'Nightmare') {
    return tier;
  }
  return `${tier} ${level}`;
}

/**
 * Get rank tier index for sorting
 * @param tier - Rank tier
 * @param level - Rank level
 * @returns Numeric index for sorting
 */
export function getRankTierIndex(tier: RankTier, level: number): number {
  const baseIndex = RANK_TIER_INDEX[tier] * 1000;
  return baseIndex + level;
}

/**
 * Calculate progress to next tier (0-100%)
 * @param displayRP - RP within current tier
 * @returns Progress percentage
 */
export function getProgressToNextTier(displayRP: number): number {
  return Math.min((displayRP / 100) * 100, 100);
}

/**
 * Get next tier information
 * @param currentTier - Current rank tier
 * @param currentLevel - Current rank level
 * @returns Next tier information or null if at max
 */
export function getNextTier(currentTier: RankTier, currentLevel: number): { tier: RankTier; level: number } | null {
  const tierOrder: RankTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald', 'Nightmare'];
  const currentIndex = tierOrder.indexOf(currentTier);
  
  if (currentIndex === -1) return null;
  
  // Check if we can advance within the same tier
  const currentTierConfig = RANK_TIERS[currentTier];
  if (currentLevel < currentTierConfig.levels) {
    return { tier: currentTier, level: currentLevel + 1 };
  }
  
  // Check if we can advance to the next tier
  if (currentIndex < tierOrder.length - 1) {
    const nextTier = tierOrder[currentIndex + 1];
    return { tier: nextTier, level: 1 };
  }
  
  // Already at maximum tier
  return null;
}

/**
 * Calculate RP needed for next tier
 * @param currentTier - Current rank tier
 * @param currentLevel - Current rank level
 * @param currentDisplayRP - Current display RP
 * @returns RP needed for next tier
 */
export function getRPNeededForNextTier(currentTier: RankTier, currentLevel: number, currentDisplayRP: number): number {
  const nextTier = getNextTier(currentTier, currentLevel);
  if (!nextTier) return 0; // Already at max
  
  const currentTierConfig = RANK_TIERS[currentTier];
  const currentTotalRP = currentTierConfig.minRp + ((currentLevel - 1) * 100) + currentDisplayRP;
  
  if (nextTier.tier === currentTier) {
    // Same tier, next level
    return 100 - currentDisplayRP;
  } else {
    // Next tier, level 1
    const nextTierConfig = RANK_TIERS[nextTier.tier];
    return nextTierConfig.minRp - currentTotalRP;
  }
}

/**
 * Check if rank change is a tier promotion
 * @param oldRank - Previous rank
 * @param newRank - New rank
 * @returns True if tier was promoted
 */
export function isTierPromotion(oldRank: CalculatedRank, newRank: CalculatedRank): boolean {
  return newRank.tierIndex > oldRank.tierIndex;
}

/**
 * Check if rank change is a tier demotion
 * @param oldRank - Previous rank
 * @param newRank - New rank
 * @returns True if tier was demoted
 */
export function isTierDemotion(oldRank: CalculatedRank, newRank: CalculatedRank): boolean {
  return newRank.tierIndex < oldRank.tierIndex;
}

/**
 * Get rank change description
 * @param oldRank - Previous rank
 * @param newRank - New rank
 * @returns Human-readable change description
 */
export function getRankChangeDescription(oldRank: CalculatedRank, newRank: CalculatedRank): string {
  if (isTierPromotion(oldRank, newRank)) {
    return `Promoted from ${oldRank.calculatedRank} to ${newRank.calculatedRank}`;
  } else if (isTierDemotion(oldRank, newRank)) {
    return `Demoted from ${oldRank.calculatedRank} to ${newRank.calculatedRank}`;
  } else if (oldRank.level !== newRank.level) {
    return `Changed from ${oldRank.calculatedRank} to ${newRank.calculatedRank}`;
  } else {
    return `Progressed in ${newRank.calculatedRank}`;
  }
}

/**
 * Sort ranks by tier and level
 * @param ranks - Array of calculated ranks
 * @returns Sorted array
 */
export function sortRanksByTier(ranks: CalculatedRank[]): CalculatedRank[] {
  return ranks.sort((a, b) => b.tierIndex - a.tierIndex);
}

/**
 * Validate RP value
 * @param rp - RP value to validate
 * @returns True if valid
 */
export function isValidRP(rp: number): boolean {
  return typeof rp === 'number' && !isNaN(rp) && rp >= 0 && rp <= 10000; // Reasonable upper limit
}

/**
 * Get rank statistics for a collection of ranks
 * @param ranks - Array of calculated ranks
 * @returns Statistics object
 */
export function getRankStatistics(ranks: CalculatedRank[]) {
  const stats = {
    totalPlayers: ranks.length,
    tierDistribution: {} as Record<RankTier, number>,
    averageRP: 0,
    highestRP: 0,
    lowestRP: 0
  };
  
  if (ranks.length === 0) return stats;
  
  // Calculate tier distribution
  ranks.forEach(rank => {
    stats.tierDistribution[rank.tier] = (stats.tierDistribution[rank.tier] || 0) + 1;
  });
  
  // Calculate RP statistics
  const totalRP = ranks.reduce((sum, rank) => sum + rank.totalRP, 0);
  stats.averageRP = Math.round(totalRP / ranks.length);
  stats.highestRP = Math.max(...ranks.map(r => r.totalRP));
  stats.lowestRP = Math.min(...ranks.map(r => r.totalRP));
  
  return stats;
}

// Cache for rank calculations to improve performance
const rankCache = new Map<number, CalculatedRank>();

/**
 * Calculate rank with caching for performance
 * @param totalRP - Raw RP value
 * @returns Cached or calculated rank
 */
export function calculateRankFromRPCached(totalRP: number): CalculatedRank {
  const cacheKey = Math.floor(totalRP);
  
  if (rankCache.has(cacheKey)) {
    return rankCache.get(cacheKey)!;
  }
  
  const calculatedRank = calculateRankFromRP(totalRP);
  rankCache.set(cacheKey, calculatedRank);
  
  // Limit cache size to prevent memory issues
  if (rankCache.size > 1000) {
    const firstKey = rankCache.keys().next().value;
    if (firstKey !== undefined) {
      rankCache.delete(firstKey);
    }
  }
  
  return calculatedRank;
}

/**
 * Clear rank calculation cache
 */
export function clearRankCache(): void {
  rankCache.clear();
} 