interface AccessCacheEntry {
  pagePath: string;
  hasAccess: boolean;
  checkedAt: number;
  requirements: {
    minTrustLevel: number;
    requiresDiscordVerification: boolean;
    requiresPaidVerification: boolean;
  };
}

interface UserAccessCache {
  userId: string;
  trustLevel: number;
  discordVerified: boolean;
  lastTrustChange: number;
  cacheTimestamp: number;
  pageAccess: Record<string, AccessCacheEntry>;
}

class AccessCacheManager {
  private static CACHE_KEY = 'user_access_cache';
  private static CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  private static MAX_CACHE_SIZE = 100; // Maximum number of cached pages per user

  /**
   * Check if localStorage is available
   */
  private static isLocalStorageAvailable(): boolean {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get cached access for a specific page
   */
  static getCachedAccess(userId: string, pagePath: string): boolean | null {
    try {
      if (!this.isLocalStorageAvailable()) {
        return null;
      }

      const cache = this.getUserCache(userId);
      if (!cache) return null;

      const entry = cache.pageAccess[pagePath];
      if (!entry) return null;

      // Check if cache is still valid
      const now = Date.now();
      if (now - entry.checkedAt > this.CACHE_EXPIRY) {
        // Remove expired entry
        delete cache.pageAccess[pagePath];
        this.saveUserCache(userId, cache);
        return null;
      }

      return entry.hasAccess;
    } catch (error) {
      console.error('Error getting cached access:', error);
      return null;
    }
  }

  /**
   * Set cached access for a specific page
   */
  static setCachedAccess(
    userId: string, 
    pagePath: string, 
    hasAccess: boolean, 
    requirements: {
      minTrustLevel: number;
      requiresDiscordVerification: boolean;
      requiresPaidVerification: boolean;
    }
  ): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        return;
      }

      let cache = this.getUserCache(userId);
      if (!cache) {
        cache = {
          userId,
          trustLevel: 0,
          discordVerified: false,
          lastTrustChange: Date.now(),
          cacheTimestamp: Date.now(),
          pageAccess: {}
        };
      }

      // Add or update the cache entry
      cache.pageAccess[pagePath] = {
        pagePath,
        hasAccess,
        checkedAt: Date.now(),
        requirements
      };

      // Limit cache size
      const pagePaths = Object.keys(cache.pageAccess);
      if (pagePaths.length > this.MAX_CACHE_SIZE) {
        // Remove oldest entries
        const sortedPaths = pagePaths.sort((a, b) => 
          cache.pageAccess[a].checkedAt - cache.pageAccess[b].checkedAt
        );
        const toRemove = sortedPaths.slice(0, pagePaths.length - this.MAX_CACHE_SIZE);
        toRemove.forEach(path => delete cache.pageAccess[path]);
      }

      this.saveUserCache(userId, cache);
    } catch (error) {
      console.error('Error setting cached access:', error);
    }
  }

  /**
   * Invalidate entire cache for a user
   */
  static invalidateCache(userId: string): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        return;
      }
      localStorage.removeItem(`${this.CACHE_KEY}_${userId}`);
    } catch (error) {
      console.error('Error invalidating cache:', error);
    }
  }

  /**
   * Invalidate cache for a specific page
   */
  static invalidatePage(userId: string, pagePath: string): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        return;
      }
      const cache = this.getUserCache(userId);
      if (cache && cache.pageAccess[pagePath]) {
        delete cache.pageAccess[pagePath];
        this.saveUserCache(userId, cache);
      }
    } catch (error) {
      console.error('Error invalidating page cache:', error);
    }
  }

  /**
   * Check if cache is valid for current user state
   */
  static isCacheValid(
    userId: string, 
    currentTrustLevel: number, 
    currentDiscordVerified: boolean
  ): boolean {
    try {
      if (!this.isLocalStorageAvailable()) {
        return false;
      }

      const cache = this.getUserCache(userId);
      if (!cache) return false;

      // Check if trust level or Discord verification status changed
      if (cache.trustLevel !== currentTrustLevel || cache.discordVerified !== currentDiscordVerified) {
        return false;
      }

      // Check if cache is expired
      const now = Date.now();
      if (now - cache.cacheTimestamp > this.CACHE_EXPIRY) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Preload access for common pages
   */
  static async preloadCommonPages(userId: string): Promise<void> {
    try {
      const commonPages = ['/strategies', '/premium-strategies', '/tracker', '/admin', '/leaderboard'];
      const cache = this.getUserCache(userId);
      
      // Only preload if we don't have recent cache
      if (cache && Date.now() - cache.cacheTimestamp < 5 * 60 * 1000) {
        return; // Cache is recent enough
      }

      // This will be called by the hook that handles the actual API calls
      console.log('Preloading common pages for user:', userId);
    } catch (error) {
      console.error('Error preloading common pages:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  static cleanup(): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        return;
      }

      const now = Date.now();
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        if (key.startsWith(this.CACHE_KEY)) {
          try {
            const cache = JSON.parse(localStorage.getItem(key) || '{}');
            if (now - cache.cacheTimestamp > this.CACHE_EXPIRY) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // Remove invalid cache entries
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  /**
   * Get cache size for monitoring
   */
  static getCacheSize(): number {
    try {
      if (!this.isLocalStorageAvailable()) {
        return 0;
      }

      const keys = Object.keys(localStorage);
      return keys.filter(key => key.startsWith(this.CACHE_KEY)).length;
    } catch (error) {
      console.error('Error getting cache size:', error);
      return 0;
    }
  }

  /**
   * Export cache for debugging
   */
  static exportCache(userId: string): UserAccessCache | null {
    try {
      if (!this.isLocalStorageAvailable()) {
        return null;
      }
      return this.getUserCache(userId);
    } catch (error) {
      console.error('Error exporting cache:', error);
      return null;
    }
  }

  /**
   * Clear all cache (useful for logout)
   */
  static clearAllCache(): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        return;
      }

      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(this.CACHE_KEY)) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  /**
   * Get user-specific cache from localStorage
   */
  private static getUserCache(userId: string): UserAccessCache | null {
    try {
      if (!this.isLocalStorageAvailable()) {
        return null;
      }

      const cached = localStorage.getItem(`${this.CACHE_KEY}_${userId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Error getting user cache:', error);
      return null;
    }
  }

  /**
   * Save user-specific cache to localStorage
   */
  private static saveUserCache(userId: string, cache: UserAccessCache): void {
    try {
      if (!this.isLocalStorageAvailable()) {
        return;
      }

      localStorage.setItem(`${this.CACHE_KEY}_${userId}`, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving user cache:', error);
    }
  }
}

export { AccessCacheManager };
export type { AccessCacheEntry, UserAccessCache };