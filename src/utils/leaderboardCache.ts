const LEADERBOARD_CACHE_KEY = 'leaderboard_raw_v1'; // Note: only raw data
const ENRICHED_CACHE_KEY = 'leaderboard_enriched_v1'; // Add enriched cache
const CURRENTLY_RANKING_CACHE_KEY = 'currently_ranking_v1'; // New cache for currently ranking
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - event-driven invalidation

// Cache for RAW leaderboard data (from Supabase)
export const getCachedRawLeaderboard = (): any[] | null => {
  try {
    const cached = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(LEADERBOARD_CACHE_KEY);
      return null;
    }
    
    console.log(`📊 Using cached RAW leaderboard data`);
    return data;
  } catch (error) {
    localStorage.removeItem(LEADERBOARD_CACHE_KEY);
    return null;
  }
};

export const setCachedRawLeaderboard = (data: any[]): void => {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    console.log(`💾 Cached RAW leaderboard data`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
};

// Cache for ENRICHED leaderboard data (with avatars/user IDs)
export const getCachedEnrichedLeaderboard = (): any[] | null => {
  try {
    const cached = localStorage.getItem(ENRICHED_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(ENRICHED_CACHE_KEY);
      return null;
    }
    
    console.log(`🎭 Using cached ENRICHED leaderboard data`);
    return data;
  } catch (error) {
    localStorage.removeItem(ENRICHED_CACHE_KEY);
    return null;
  }
};

export const setCachedEnrichedLeaderboard = (data: any[]): void => {
  try {
    localStorage.setItem(ENRICHED_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    console.log(`💾 Cached ENRICHED leaderboard data`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
};

// Cache for CURRENTLY RANKING data with smart invalidation
export const getCachedCurrentlyRanking = (): any[] | null => {
  try {
    const cached = localStorage.getItem(CURRENTLY_RANKING_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid (no trigger-based logic here)
    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CURRENTLY_RANKING_CACHE_KEY);
      return null;
    }
    
    console.log(`🔥 Using cached currently ranking data`);
    return data;
  } catch (error) {
    localStorage.removeItem(CURRENTLY_RANKING_CACHE_KEY);
    return null;
  }
};

export const setCachedCurrentlyRanking = (data: any[]): void => {
  try {
    localStorage.setItem(CURRENTLY_RANKING_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    console.log(`💾 Cached currently ranking data`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
};

// Clear currently ranking cache
export const clearCurrentlyRankingCache = (): void => {
  localStorage.removeItem(CURRENTLY_RANKING_CACHE_KEY);
  console.log('🗑️ Cleared currently ranking cache');
};

// Get cache status for currently ranking data
export const getCurrentlyRankingCacheStatus = (): {
  hasCache: boolean;
  isExpired: boolean;
} => {
  try {
    const cached = localStorage.getItem(CURRENTLY_RANKING_CACHE_KEY);
    if (!cached) {
      return { hasCache: false, isExpired: false };
    }
    
    const { timestamp } = JSON.parse(cached);
    const now = Date.now();
    const isExpired = now - timestamp > CACHE_DURATION;
    
    return {
      hasCache: true,
      isExpired
    };
  } catch (error) {
    return { hasCache: false, isExpired: false };
  }
};

export const clearAllLeaderboardCache = (): void => {
  localStorage.removeItem(LEADERBOARD_CACHE_KEY);
  localStorage.removeItem(ENRICHED_CACHE_KEY);
  localStorage.removeItem(CURRENTLY_RANKING_CACHE_KEY);
  console.log('🗑️ Cleared all leaderboard cache');
};

export const getCacheAge = (): number | null => {
  try {
    const cached = localStorage.getItem(LEADERBOARD_CACHE_KEY);
    if (!cached) return null;
    
    const { timestamp }: { timestamp: number } = JSON.parse(cached);
    return Math.round((Date.now() - timestamp) / 60000); // age in minutes
  } catch {
    return null;
  }
};

// Enhanced cache invalidation with currently ranking support
export const setupCacheInvalidationListener = (supabase: any) => {
  const channel = supabase
    .channel('cache_invalidation')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'leaderboard_refresh_trigger'
      },
      (payload: any) => {
        console.log('🔄 New leaderboard data detected, will clear cache in 30 seconds');
        
        // Clear all caches after 30 seconds (including currently ranking)
        setTimeout(() => {
          clearAllLeaderboardCache();
          clearCurrentlyRankingCache();
          window.dispatchEvent(new CustomEvent('leaderboard_data_updated'));
          window.dispatchEvent(new CustomEvent('currently_ranking_cache_cleared'));
          console.log('🕒 All caches cleared after 30s delay');
        }, 30000); // 30 seconds
      }
    )
    .subscribe();
  return channel;
}; 