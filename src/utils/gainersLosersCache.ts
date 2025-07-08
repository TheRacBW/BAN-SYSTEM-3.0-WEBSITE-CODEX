const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes - event-driven invalidation

// Cache keys for different time ranges
const getCacheKey = (type: 'gainers' | 'losers', timeRange: string) => {
  return `${type}_${timeRange}_cache_v1`;
};

// Get cached data for specific time range
export const getCachedGainersLosers = (type: 'gainers' | 'losers', timeRange: string): any[] | null => {
  try {
    const cacheKey = getCacheKey(type, timeRange);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log(`📊 Using cached ${type} data for ${timeRange} range`);
    return data;
  } catch (error) {
    console.error(`Cache read error for ${type} ${timeRange}:`, error);
    return null;
  }
};

// Set cached data for specific time range
export const setCachedGainersLosers = (type: 'gainers' | 'losers', timeRange: string, data: any[]): void => {
  try {
    const cacheKey = getCacheKey(type, timeRange);
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    console.log(`💾 Cached ${type} data for ${timeRange} range (${data.length} entries)`);
  } catch (error) {
    console.error(`Cache write error for ${type} ${timeRange}:`, error);
  }
};

// Clear all gainers/losers caches (called on refresh trigger)
export const clearAllGainersLosersCache = (): void => {
  const timeRanges = ['12h', '1d', '2d'];
  const types = ['gainers', 'losers'];
  
  timeRanges.forEach(timeRange => {
    types.forEach(type => {
      const cacheKey = getCacheKey(type, timeRange);
      localStorage.removeItem(cacheKey);
    });
  });
  
  console.log('🗑️ Cleared all gainers/losers cache for all time ranges');
};

// Setup cache invalidation listener (same trigger as main leaderboard)
export const setupGainersLosersCacheInvalidation = (supabase: any) => {
  const channel = supabase
    .channel('gainers_losers_cache_invalidation')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'leaderboard_refresh_trigger'
      },
      (payload: any) => {
        console.log('🔄 New leaderboard data detected, will clear gainers/losers cache in 30 seconds');
        setTimeout(() => {
          clearAllGainersLosersCache();
          window.dispatchEvent(new CustomEvent('gainers_losers_cache_cleared'));
          console.log('🕒 Gainers/losers cache cleared after 30s delay');
        }, 30000);
      }
    )
    .subscribe();
  
  return channel;
}; 