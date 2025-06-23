import { describe, test, expect } from '@jest/globals';
import { 
  calculateRankFromRP, 
  getRankDisplayName, 
  getRankTierColor, 
  getRankTierEmoji, 
  getRankTierIndex, 
  getProgressToNextTier,
  RANK_TIERS,
  RANK_TIER_INDEX
} from '../src/types/leaderboard';

describe('21-Tier Ranking System', () => {
  describe('calculateRankFromRP', () => {
    test('should handle negative RP', () => {
      const result = calculateRankFromRP(-100);
      expect(result.rank_tier).toBe('Bronze');
      expect(result.rank_number).toBe(1);
      expect(result.display_rp).toBe(0);
    });

    test('should handle zero RP', () => {
      const result = calculateRankFromRP(0);
      expect(result.rank_tier).toBe('Bronze');
      expect(result.rank_number).toBe(1);
      expect(result.display_rp).toBe(0);
    });

    describe('Bronze ranks (0-399 RP)', () => {
      test('Bronze 1: 0-99 RP', () => {
        const result = calculateRankFromRP(50);
        expect(result.rank_tier).toBe('Bronze');
        expect(result.rank_number).toBe(1);
        expect(result.display_rp).toBe(50);
      });

      test('Bronze 2: 100-199 RP', () => {
        const result = calculateRankFromRP(150);
        expect(result.rank_tier).toBe('Bronze');
        expect(result.rank_number).toBe(2);
        expect(result.display_rp).toBe(50);
      });

      test('Bronze 3: 200-299 RP', () => {
        const result = calculateRankFromRP(250);
        expect(result.rank_tier).toBe('Bronze');
        expect(result.rank_number).toBe(3);
        expect(result.display_rp).toBe(50);
      });

      test('Bronze 4: 300-399 RP', () => {
        const result = calculateRankFromRP(350);
        expect(result.rank_tier).toBe('Bronze');
        expect(result.rank_number).toBe(4);
        expect(result.display_rp).toBe(50);
      });
    });

    describe('Silver ranks (400-799 RP)', () => {
      test('Silver 1: 400-499 RP', () => {
        const result = calculateRankFromRP(450);
        expect(result.rank_tier).toBe('Silver');
        expect(result.rank_number).toBe(1);
        expect(result.display_rp).toBe(50);
      });

      test('Silver 2: 500-599 RP', () => {
        const result = calculateRankFromRP(550);
        expect(result.rank_tier).toBe('Silver');
        expect(result.rank_number).toBe(2);
        expect(result.display_rp).toBe(50);
      });

      test('Silver 3: 600-699 RP', () => {
        const result = calculateRankFromRP(650);
        expect(result.rank_tier).toBe('Silver');
        expect(result.rank_number).toBe(3);
        expect(result.display_rp).toBe(50);
      });

      test('Silver 4: 700-799 RP', () => {
        const result = calculateRankFromRP(750);
        expect(result.rank_tier).toBe('Silver');
        expect(result.rank_number).toBe(4);
        expect(result.display_rp).toBe(50);
      });
    });

    describe('Gold ranks (800-1199 RP)', () => {
      test('Gold 1: 800-899 RP', () => {
        const result = calculateRankFromRP(850);
        expect(result.rank_tier).toBe('Gold');
        expect(result.rank_number).toBe(1);
        expect(result.display_rp).toBe(50);
      });

      test('Gold 2: 900-999 RP', () => {
        const result = calculateRankFromRP(950);
        expect(result.rank_tier).toBe('Gold');
        expect(result.rank_number).toBe(2);
        expect(result.display_rp).toBe(50);
      });

      test('Gold 3: 1000-1099 RP', () => {
        const result = calculateRankFromRP(1050);
        expect(result.rank_tier).toBe('Gold');
        expect(result.rank_number).toBe(3);
        expect(result.display_rp).toBe(50);
      });

      test('Gold 4: 1100-1199 RP', () => {
        const result = calculateRankFromRP(1150);
        expect(result.rank_tier).toBe('Gold');
        expect(result.rank_number).toBe(4);
        expect(result.display_rp).toBe(50);
      });
    });

    describe('Platinum ranks (1200-1599 RP)', () => {
      test('Platinum 1: 1200-1299 RP', () => {
        const result = calculateRankFromRP(1250);
        expect(result.rank_tier).toBe('Platinum');
        expect(result.rank_number).toBe(1);
        expect(result.display_rp).toBe(50);
      });

      test('Platinum 2: 1300-1399 RP', () => {
        const result = calculateRankFromRP(1350);
        expect(result.rank_tier).toBe('Platinum');
        expect(result.rank_number).toBe(2);
        expect(result.display_rp).toBe(50);
      });

      test('Platinum 3: 1400-1499 RP', () => {
        const result = calculateRankFromRP(1450);
        expect(result.rank_tier).toBe('Platinum');
        expect(result.rank_number).toBe(3);
        expect(result.display_rp).toBe(50);
      });

      test('Platinum 4: 1500-1599 RP', () => {
        const result = calculateRankFromRP(1550);
        expect(result.rank_tier).toBe('Platinum');
        expect(result.rank_number).toBe(4);
        expect(result.display_rp).toBe(50);
      });
    });

    describe('Diamond ranks (1600-1899 RP)', () => {
      test('Diamond 1: 1600-1699 RP', () => {
        const result = calculateRankFromRP(1650);
        expect(result.rank_tier).toBe('Diamond');
        expect(result.rank_number).toBe(1);
        expect(result.display_rp).toBe(50);
      });

      test('Diamond 2: 1700-1799 RP', () => {
        const result = calculateRankFromRP(1750);
        expect(result.rank_tier).toBe('Diamond');
        expect(result.rank_number).toBe(2);
        expect(result.display_rp).toBe(50);
      });

      test('Diamond 3: 1800-1899 RP', () => {
        const result = calculateRankFromRP(1850);
        expect(result.rank_tier).toBe('Diamond');
        expect(result.rank_number).toBe(3);
        expect(result.display_rp).toBe(50);
      });
    });

    describe('Emerald rank (1900-1999 RP)', () => {
      test('Emerald: 1900-1999 RP', () => {
        const result = calculateRankFromRP(1950);
        expect(result.rank_tier).toBe('Emerald');
        expect(result.rank_number).toBe(0);
        expect(result.display_rp).toBe(50);
      });
    });

    describe('Nightmare rank (2000+ RP)', () => {
      test('Nightmare: 2000+ RP', () => {
        const result = calculateRankFromRP(2500);
        expect(result.rank_tier).toBe('Nightmare');
        expect(result.rank_number).toBe(0);
        expect(result.display_rp).toBe(500);
      });

      test('Nightmare: exactly 2000 RP', () => {
        const result = calculateRankFromRP(2000);
        expect(result.rank_tier).toBe('Nightmare');
        expect(result.rank_number).toBe(0);
        expect(result.display_rp).toBe(0);
      });
    });

    test('should handle edge cases at tier boundaries', () => {
      // Bronze 4 to Silver 1
      expect(calculateRankFromRP(399).rank_tier).toBe('Bronze');
      expect(calculateRankFromRP(400).rank_tier).toBe('Silver');
      
      // Silver 4 to Gold 1
      expect(calculateRankFromRP(799).rank_tier).toBe('Silver');
      expect(calculateRankFromRP(800).rank_tier).toBe('Gold');
      
      // Gold 4 to Platinum 1
      expect(calculateRankFromRP(1199).rank_tier).toBe('Gold');
      expect(calculateRankFromRP(1200).rank_tier).toBe('Platinum');
      
      // Platinum 4 to Diamond 1
      expect(calculateRankFromRP(1599).rank_tier).toBe('Platinum');
      expect(calculateRankFromRP(1600).rank_tier).toBe('Diamond');
      
      // Diamond 3 to Emerald
      expect(calculateRankFromRP(1899).rank_tier).toBe('Diamond');
      expect(calculateRankFromRP(1900).rank_tier).toBe('Emerald');
      
      // Emerald to Nightmare
      expect(calculateRankFromRP(1999).rank_tier).toBe('Emerald');
      expect(calculateRankFromRP(2000).rank_tier).toBe('Nightmare');
    });
  });

  describe('getRankDisplayName', () => {
    test('should format tier names correctly', () => {
      expect(getRankDisplayName('Bronze', 1)).toBe('Bronze 1');
      expect(getRankDisplayName('Silver', 3)).toBe('Silver 3');
      expect(getRankDisplayName('Gold', 4)).toBe('Gold 4');
      expect(getRankDisplayName('Platinum', 2)).toBe('Platinum 2');
      expect(getRankDisplayName('Diamond', 1)).toBe('Diamond 1');
    });

    test('should handle special tiers without numbers', () => {
      expect(getRankDisplayName('Emerald', 0)).toBe('Emerald');
      expect(getRankDisplayName('Nightmare', 0)).toBe('Nightmare');
    });
  });

  describe('getRankTierColor', () => {
    test('should return correct colors for each tier', () => {
      expect(getRankTierColor('Bronze')).toBe('#CD7F32');
      expect(getRankTierColor('Silver')).toBe('#C0C0C0');
      expect(getRankTierColor('Gold')).toBe('#FFD700');
      expect(getRankTierColor('Platinum')).toBe('#E5E4E2');
      expect(getRankTierColor('Diamond')).toBe('#B9F2FF');
      expect(getRankTierColor('Emerald')).toBe('#50C878');
      expect(getRankTierColor('Nightmare')).toBe('#8B0000');
    });
  });

  describe('getRankTierEmoji', () => {
    test('should return correct emojis for each tier', () => {
      expect(getRankTierEmoji('Bronze')).toBe('🥉');
      expect(getRankTierEmoji('Silver')).toBe('🥈');
      expect(getRankTierEmoji('Gold')).toBe('🥇');
      expect(getRankTierEmoji('Platinum')).toBe('💎');
      expect(getRankTierEmoji('Diamond')).toBe('💎');
      expect(getRankTierEmoji('Emerald')).toBe('💚');
      expect(getRankTierEmoji('Nightmare')).toBe('👹');
    });
  });

  describe('getRankTierIndex', () => {
    test('should return correct indices for sorting', () => {
      expect(getRankTierIndex('Bronze', 1)).toBe(1001);
      expect(getRankTierIndex('Bronze', 4)).toBe(1004);
      expect(getRankTierIndex('Silver', 1)).toBe(2001);
      expect(getRankTierIndex('Gold', 3)).toBe(3003);
      expect(getRankTierIndex('Platinum', 2)).toBe(4002);
      expect(getRankTierIndex('Diamond', 1)).toBe(5001);
      expect(getRankTierIndex('Emerald', 0)).toBe(6000);
      expect(getRankTierIndex('Nightmare', 0)).toBe(7000);
    });

    test('should sort tiers correctly', () => {
      const ranks = [
        { tier: 'Gold', number: 1 },
        { tier: 'Bronze', number: 4 },
        { tier: 'Nightmare', number: 0 },
        { tier: 'Silver', number: 2 },
        { tier: 'Emerald', number: 0 }
      ];

      const sorted = ranks.sort((a, b) => 
        getRankTierIndex(a.tier as any, a.number) - getRankTierIndex(b.tier as any, b.number)
      );

      expect(sorted[0].tier).toBe('Bronze');
      expect(sorted[1].tier).toBe('Silver');
      expect(sorted[2].tier).toBe('Gold');
      expect(sorted[3].tier).toBe('Emerald');
      expect(sorted[4].tier).toBe('Nightmare');
    });
  });

  describe('getProgressToNextTier', () => {
    test('should calculate progress correctly', () => {
      expect(getProgressToNextTier(0)).toBe(0);
      expect(getProgressToNextTier(25)).toBe(25);
      expect(getProgressToNextTier(50)).toBe(50);
      expect(getProgressToNextTier(75)).toBe(75);
      expect(getProgressToNextTier(100)).toBe(100);
      expect(getProgressToNextTier(150)).toBe(100); // Cap at 100%
    });
  });

  describe('RANK_TIERS configuration', () => {
    test('should have correct tier ranges', () => {
      expect(RANK_TIERS.Bronze.minRp).toBe(0);
      expect(RANK_TIERS.Bronze.maxRp).toBe(399);
      
      expect(RANK_TIERS.Silver.minRp).toBe(400);
      expect(RANK_TIERS.Silver.maxRp).toBe(799);
      
      expect(RANK_TIERS.Gold.minRp).toBe(800);
      expect(RANK_TIERS.Gold.maxRp).toBe(1199);
      
      expect(RANK_TIERS.Platinum.minRp).toBe(1200);
      expect(RANK_TIERS.Platinum.maxRp).toBe(1599);
      
      expect(RANK_TIERS.Diamond.minRp).toBe(1600);
      expect(RANK_TIERS.Diamond.maxRp).toBe(1899);
      
      expect(RANK_TIERS.Emerald.minRp).toBe(1900);
      expect(RANK_TIERS.Emerald.maxRp).toBe(1999);
      
      expect(RANK_TIERS.Nightmare.minRp).toBe(2000);
      expect(RANK_TIERS.Nightmare.maxRp).toBe(Infinity);
    });

    test('should have correct colors', () => {
      expect(RANK_TIERS.Bronze.color).toBe('#CD7F32');
      expect(RANK_TIERS.Silver.color).toBe('#C0C0C0');
      expect(RANK_TIERS.Gold.color).toBe('#FFD700');
      expect(RANK_TIERS.Platinum.color).toBe('#E5E4E2');
      expect(RANK_TIERS.Diamond.color).toBe('#B9F2FF');
      expect(RANK_TIERS.Emerald.color).toBe('#50C878');
      expect(RANK_TIERS.Nightmare.color).toBe('#8B0000');
    });

    test('should have correct emojis', () => {
      expect(RANK_TIERS.Bronze.emoji).toBe('🥉');
      expect(RANK_TIERS.Silver.emoji).toBe('🥈');
      expect(RANK_TIERS.Gold.emoji).toBe('🥇');
      expect(RANK_TIERS.Platinum.emoji).toBe('💎');
      expect(RANK_TIERS.Diamond.emoji).toBe('💎');
      expect(RANK_TIERS.Emerald.emoji).toBe('💚');
      expect(RANK_TIERS.Nightmare.emoji).toBe('👹');
    });
  });

  describe('RANK_TIER_INDEX configuration', () => {
    test('should have correct indices', () => {
      expect(RANK_TIER_INDEX.Bronze).toBe(1);
      expect(RANK_TIER_INDEX.Silver).toBe(2);
      expect(RANK_TIER_INDEX.Gold).toBe(3);
      expect(RANK_TIER_INDEX.Platinum).toBe(4);
      expect(RANK_TIER_INDEX.Diamond).toBe(5);
      expect(RANK_TIER_INDEX.Emerald).toBe(6);
      expect(RANK_TIER_INDEX.Nightmare).toBe(7);
    });
  });
}); 