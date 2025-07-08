const LEADERBOARD_CACHE_KEY = 'leaderboard_raw_v1'; // Note: only raw data
const ENRICHED_CACHE_KEY = 'leaderboard_enriched_v1'; // Add enriched cache
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

export const clearAllLeaderboardCache = (): void => {
  localStorage.removeItem(LEADERBOARD_CACHE_KEY);
  localStorage.removeItem(ENRICHED_CACHE_KEY);
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
      (_payload: any) => {
        console.log('🔄 New leaderboard data detected, will clear cache in 30 seconds');
        setTimeout(() => {
          clearAllLeaderboardCache();
          window.dispatchEvent(new CustomEvent('leaderboard_data_updated'));
          console.log('🕒 Cache cleared and leaderboard_data_updated event dispatched after 30s delay');
        }, 30000); // 30 seconds
      }
    )
    .subscribe();
  return channel;
}; 