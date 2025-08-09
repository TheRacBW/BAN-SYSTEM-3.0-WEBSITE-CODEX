/**
 * Activity Pulse Performance Optimizations
 * 
 * Provides caching, memoization, and optimized calculations
 * to improve activity pulse system performance.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ActivityPulseCache {
  private static cache = new Map<string, CacheEntry<any>>();
  private static readonly DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes
  private static readonly ACTIVITY_LEVEL_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly TIMEZONE_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get cached data or execute function if not cached/expired
   */
  static async get<T>(
    key: string, 
    fetchFn: () => Promise<T> | T,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if valid
    if (cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data;
    }

    // Fetch new data
    const data = await fetchFn();
    
    // Cache the result
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl
    });

    return data;
  }

  /**
   * Cached activity level calculation
   */
  static getCachedActivityLevel(
    dailyMinutes: number,
    weeklyAverage: number,
    isOnline: boolean
  ) {
    const cacheKey = `activity_level_${dailyMinutes}_${weeklyAverage}_${isOnline}`;
    
    return this.get(
      cacheKey,
      () => {
        // Import here to avoid circular dependency
        const { getActivityLevel } = require('./activityPulseUtils');
        return getActivityLevel(dailyMinutes, weeklyAverage, isOnline);
      },
      this.ACTIVITY_LEVEL_TTL
    );
  }

  /**
   * Cached timezone detection
   */
  static getCachedTimezone(activityDistribution: Record<string, number>) {
    const distributionHash = this.hashObject(activityDistribution);
    const cacheKey = `timezone_${distributionHash}`;
    
    return this.get(
      cacheKey,
      () => {
        const { detectTimezoneFromPattern } = require('./activityPulseUtils');
        return detectTimezoneFromPattern(activityDistribution);
      },
      this.TIMEZONE_TTL
    );
  }

  /**
   * Batch cache multiple activity calculations
   */
  static async batchCacheActivities(activities: Array<{
    userId: string;
    dailyMinutes: number;
    weeklyAverage: number;
    isOnline: boolean;
  }>) {
    const promises = activities.map(activity => {
      const cacheKey = `activity_level_${activity.dailyMinutes}_${activity.weeklyAverage}_${activity.isOnline}`;
      
      return this.get(cacheKey, () => {
        const { getActivityLevel } = require('./activityPulseUtils');
        return getActivityLevel(activity.dailyMinutes, activity.weeklyAverage, activity.isOnline);
      }, this.ACTIVITY_LEVEL_TTL);
    });

    return Promise.all(promises);
  }

  /**
   * Clear expired cache entries
   */
  static cleanup() {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) >= entry.ttl) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.cache.delete(key));
    
    return {
      deleted: toDelete.length,
      remaining: this.cache.size
    };
  }

  /**
   * Get cache statistics
   */
  static getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const entry of this.cache.values()) {
      if ((now - entry.timestamp) < entry.ttl) {
        valid++;
      } else {
        expired++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      hitRate: valid / Math.max(1, this.cache.size)
    };
  }

  /**
   * Clear all cache
   */
  static clear() {
    const size = this.cache.size;
    this.cache.clear();
    return size;
  }

  /**
   * Hash object for cache key generation
   */
  private static hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Optimized activity aggregation for multiple accounts
 */
export const optimizedAggregateActivity = async (playerAccounts: any[]) => {
  if (!playerAccounts || playerAccounts.length === 0) {
    return {
      totalDailyMinutes: 0,
      avgWeeklyAverage: 0,
      activityTrend: 'stable' as const,
      isCurrentlyOnline: false
    };
  }

  // Batch process activity levels
  const activities = playerAccounts.map(account => ({
    userId: account.user_id?.toString() || account.id,
    dailyMinutes: account.status?.dailyMinutesToday || 0,
    weeklyAverage: account.status?.weeklyAverage || 0,
    isOnline: Boolean(account.status?.inBedwars || account.status?.isInGame)
  }));

  // Use cached calculations
  const activityLevels = await ActivityPulseCache.batchCacheActivities(activities);

  // FIXED: Use maximum daily minutes instead of sum
  const maxDailyMinutes = Math.max(...activities.map(activity => activity.dailyMinutes), 0);
  const totalDailyMinutes = Math.min(720, maxDailyMinutes);
  
  const avgWeeklyAverage = Math.min(300,
    activities.reduce((sum, activity) => sum + activity.weeklyAverage, 0) / Math.max(1, activities.length)
  );

  const hasMeaningfulActivity = activities.some(activity => activity.isOnline);

  // Determine trend (optimized)
  const increasingCount = activityLevels.filter(level => 
    level.level === 'very_high' || level.level === 'high'
  ).length;
  
  const totalAccounts = activities.length;
  let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  
  if (increasingCount > totalAccounts * 0.6) {
    activityTrend = 'increasing';
  } else if (increasingCount < totalAccounts * 0.2) {
    activityTrend = 'decreasing';
  }

  return {
    totalDailyMinutes: Math.round(totalDailyMinutes),
    avgWeeklyAverage: Math.round(avgWeeklyAverage),
    activityTrend,
    isCurrentlyOnline: hasMeaningfulActivity
  };
};

/**
 * Auto-cleanup cache every 10 minutes
 */
if (typeof window !== 'undefined') {
  setInterval(() => {
    const stats = ActivityPulseCache.cleanup();
    console.log('Activity Pulse Cache cleanup:', stats);
  }, 10 * 60 * 1000);
}

export default ActivityPulseCache;