import { useState, useEffect, useCallback, useRef } from 'react';
import { leaderboardService, getTimeFilter, getCurrentlyRankingPlayers } from '../services/leaderboardService';
// import { robloxApi } from '../services/robloxApi'; // No longer needed for user ID lookup
import { lookupRobloxUserIds } from '../lib/robloxUserLookup';
import {
  LeaderboardEntryWithChanges,
  RPChangeWithTimeRange,
  LeaderboardState,
  TabType,
  TimeRange
} from '../types/leaderboard';
import { supabase } from '../lib/supabase';
import {
  getCachedRawLeaderboard,
  setCachedRawLeaderboard,
  getCachedEnrichedLeaderboard,
  setCachedEnrichedLeaderboard,
  clearAllLeaderboardCache,
  setupCacheInvalidationListener,
  getCacheAge,
  getCachedCurrentlyRanking,
  setCachedCurrentlyRanking,
  getCurrentlyRankingCacheStatus
} from '../utils/leaderboardCache';
import {
  getCachedGainersLosers,
  setCachedGainersLosers,
  setupGainersLosersCacheInvalidation
} from '../utils/gainersLosersCache';

const DEFAULT_TIME_RANGE: TimeRange = '12h';
const ROBLOX_THUMBNAIL_PROXY = 'https://theracsproxy.theraccoonmolester.workers.dev/v1/users/avatar-headshot';

console.log('🔄 useLeaderboard HOOK LOADED');

export const useLeaderboard = () => {
  // Main leaderboard
  const [entries, setEntries] = useState<LeaderboardEntryWithChanges[]>([]);
  const [previousEntries, setPreviousEntries] = useState<LeaderboardEntryWithChanges[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);

  // Gainers/losers
  const [gainers, setGainers] = useState<RPChangeWithTimeRange[]>([]);
  const [losers, setLosers] = useState<RPChangeWithTimeRange[]>([]);
  const [gainersTimeRange, setGainersTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const [losersTimeRange, setLosersTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);
  const [isLoadingGainers, setIsLoadingGainers] = useState(false);
  const [isLoadingLosers, setIsLoadingLosers] = useState(false);

  // Progressive loading: fetch leaderboard, then enrich avatars in background
  const [entriesWithAvatars, setEntriesWithAvatars] = useState<LeaderboardEntryWithChanges[]>([]);

  // Caching for time range queries
  const gainersCache = useRef<Record<string, any[]>>({});
  const losersCache = useRef<Record<string, any[]>>({});
  const [lastInsightsUpdate, setLastInsightsUpdate] = useState<string>('');
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Utility to convert LeaderboardEntry to LeaderboardEntryWithChanges
  function toWithChanges(entry: any): LeaderboardEntryWithChanges {
    return {
      ...entry,
      rp_change: 0,
      position_change: 0,
      rank_title_change: null,
      has_changes: false,
      previous_position: entry.rank_position,
      previous_rp: entry.rp,
      previous_rank_title: entry.rank_title
    };
  }

  const enrichWithRobloxData = async (rawData: any[]) => {
    // Step 1: Add changes structure
    const coreWithChanges = rawData.map(toWithChanges);
    // Step 2: Batch load user IDs and cached avatars using bright-function
    const usernames = coreWithChanges.map(entry => entry.username);
    const lookupResults = await lookupRobloxUserIds(usernames);
    const userIdMap = new Map<string, { user_id: number | null, profile_picture_url: string | null }>();
    lookupResults.forEach(result => {
      let userId: number | null = null;
      if (typeof result.user_id === 'number') {
        userId = result.user_id;
      } else if (typeof result.user_id === 'string' && !isNaN(Number(result.user_id))) {
        userId = Number(result.user_id);
      }
      const profile_picture_url = (result as any).profile_picture_url ?? null;
      const key = result.username.toLowerCase();
      userIdMap.set(key, { user_id: userId, profile_picture_url });
    });
    const entriesWithUserIds = coreWithChanges.map(entry => {
      const key = entry.username.toLowerCase();
      const mapped = userIdMap.get(key);
      return {
        ...entry,
        user_id: mapped?.user_id ?? entry.user_id ?? null,
        profile_picture: mapped?.profile_picture_url ?? null
      };
    });
    // Step 3: Fallback avatars for missing/failed images
    const entriesNeedingProxy = entriesWithUserIds.filter(e => !e.profile_picture || e.profile_picture === '' || e.profile_picture === null);
    if (entriesNeedingProxy.length > 0) {
      const pictureMap = new Map<number, { imageUrl: string, targetId: number }>();
      await Promise.all(entriesNeedingProxy.map(async (entry) => {
        if (typeof entry.user_id !== 'number' || isNaN(entry.user_id)) return;
        try {
          const url = `${ROBLOX_THUMBNAIL_PROXY}?userIds=${entry.user_id}&size=150x150&format=Png&isCircular=true`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const imageUrl = data.data?.[0]?.imageUrl || '/default-avatar.svg';
            const targetId = data.data?.[0]?.targetId || entry.user_id;
            pictureMap.set(entry.user_id, { imageUrl, targetId });
          } else {
            pictureMap.set(entry.user_id, { imageUrl: '/default-avatar.svg', targetId: entry.user_id });
          }
        } catch (err) {
          pictureMap.set(entry.user_id, { imageUrl: '/default-avatar.svg', targetId: entry.user_id });
        }
      }));
      const fullyEnrichedEntries = entriesWithUserIds.map(entry => {
        if (!entry.profile_picture || entry.profile_picture === '' || entry.profile_picture === null) {
          if (typeof entry.user_id === 'number' && pictureMap.has(entry.user_id)) {
            const { imageUrl, targetId } = pictureMap.get(entry.user_id)!;
            return {
              ...entry,
              profile_picture: imageUrl,
              user_id: targetId
            };
          }
          return {
            ...entry,
            profile_picture: '/default-avatar.svg'
          };
        }
        return entry;
      });
      return fullyEnrichedEntries;
    } else {
      return entriesWithUserIds;
    }
  };

  const fetchLeaderboard = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      let lastUpdateValue = '';
      // 1. Try enriched cache first
      if (!forceRefresh) {
        const enrichedCache = getCachedEnrichedLeaderboard();
        if (enrichedCache) {
          setIsUsingCache(true);
          setEntries(enrichedCache);
          // Set lastUpdate from the most recent entry
          if (enrichedCache.length > 0 && enrichedCache[0].inserted_at) {
            lastUpdateValue = enrichedCache[0].inserted_at;
          }
          setLastUpdate(lastUpdateValue);
          setIsLoading(false);
          setIsInitialLoading(false);
          return enrichedCache;
        }
      }
      // 2. Try raw cache
      let rawData;
      if (!forceRefresh) {
        rawData = getCachedRawLeaderboard();
        if (rawData) {
          setIsUsingCache(true);
          if (rawData.length > 0 && rawData[0].inserted_at) {
            lastUpdateValue = rawData[0].inserted_at;
          }
        }
      }
      // 3. If no raw cache, fetch from Supabase
      if (!rawData) {
        setIsUsingCache(false);
        rawData = await leaderboardService.getCurrentLeaderboardWithChanges();
        setCachedRawLeaderboard(rawData);
        // Get last update time from stats
        const stats = await leaderboardService.getLeaderboardStats();
        lastUpdateValue = stats.lastUpdated;
      }
      // 4. Always enrich
      const enrichedData = await enrichWithRobloxData(rawData);
      setCachedEnrichedLeaderboard(enrichedData);
      setEntries(enrichedData);
      // Set lastUpdate from enriched data if possible
      if (!lastUpdateValue && enrichedData.length > 0 && enrichedData[0].inserted_at) {
        lastUpdateValue = enrichedData[0].inserted_at;
      }
      setLastUpdate(lastUpdateValue);
      setIsLoading(false);
      setIsInitialLoading(false);
      return enrichedData;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch leaderboard data');
      setIsLoading(false);
      setIsInitialLoading(false);
      throw error;
    }
  };

  // Manual refresh clears all caches
  const manualRefresh = () => {
    clearAllLeaderboardCache();
    fetchLeaderboard(true);
  };

  // Debounced setters for time range
  const setGainersTimeRangeDebounced = (range: string) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => setGainersTimeRange(range as any), 200);
  };
  const setLosersTimeRangeDebounced = (range: string) => {
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    debounceTimeout.current = setTimeout(() => setLosersTimeRange(range as any), 200);
  };

  // Fetch gainers/losers for a time range with caching
  const fetchGainers = useCallback(async (timeRange: string, forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cachedData = getCachedGainersLosers('gainers', timeRange);
        if (cachedData) {
          setGainers(cachedData);
          if (cachedData.length > 0) {
            setLastInsightsUpdate(cachedData[0].change_timestamp);
          }
          return cachedData;
        }
      }
      setIsLoadingGainers(true);
      const { data, error } = await supabase
        .from('leaderboard_insights')
        .select('*')
        .in('category', ['gainer_established', 'gainer_new'])
        .gte('change_timestamp', getTimeFilter(timeRange as TimeRange))
        .order('rp_change', { ascending: false });
      if (error) throw error;
      setCachedGainersLosers('gainers', timeRange, data || []);
      setGainers(data || []);
      if (data && data.length > 0) {
        setLastInsightsUpdate(data[0].change_timestamp);
      }
      return data || [];
    } catch (err) {
      setGainers([]);
      throw err;
    } finally {
      setIsLoadingGainers(false);
    }
  }, []);

  const fetchLosers = useCallback(async (timeRange: string, forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cachedData = getCachedGainersLosers('losers', timeRange);
        if (cachedData) {
          setLosers(cachedData);
          if (cachedData.length > 0) {
            setLastInsightsUpdate(cachedData[0].change_timestamp);
          }
          return cachedData;
        }
      }
      setIsLoadingLosers(true);
      const { data, error } = await supabase
        .from('leaderboard_insights')
        .select('*')
        .in('category', ['loser_ranked', 'loser_dropped'])
        .gte('change_timestamp', getTimeFilter(timeRange as TimeRange))
        .order('rp_change', { ascending: true });
      if (error) throw error;
      setCachedGainersLosers('losers', timeRange, data || []);
      setLosers(data || []);
      if (data && data.length > 0) {
        setLastInsightsUpdate(data[0].change_timestamp);
      }
      return data || [];
    } catch (err) {
      setLosers([]);
      throw err;
    } finally {
      setIsLoadingLosers(false);
    }
  }, []);

  // Auto-refresh
  const startAutoRefresh = useCallback(() => {
    console.log('🔄 STARTING AUTO-REFRESH at', new Date().toISOString());
    if (refreshInterval) clearInterval(refreshInterval);
    const interval = setInterval(() => {
      console.log('🔄 AUTO-REFRESH TRIGGERED at', new Date().toISOString());
      setIsRefreshing(true);
      fetchLeaderboard().finally(() => setIsRefreshing(false));
    }, 300000); // 5 minutes
    setRefreshInterval(interval);
  }, [fetchLeaderboard, refreshInterval]);
  const stopAutoRefresh = useCallback(() => {
    console.log('⏸️ STOPPING AUTO-REFRESH at', new Date().toISOString());
    if (refreshInterval) clearInterval(refreshInterval);
    setRefreshInterval(null);
  }, [refreshInterval]);

  // Initial fetch
  useEffect(() => {
    console.log('🚀 INITIAL FETCH TRIGGERED at', new Date().toISOString());
    fetchLeaderboard();
    fetchGainers(gainersTimeRange);
    fetchLosers(losersTimeRange);
    startAutoRefresh();
    return () => stopAutoRefresh();
    // eslint-disable-next-line
  }, []);

  // Refetch gainers/losers when time range changes
  useEffect(() => {
    fetchGainers(gainersTimeRange);
  }, [gainersTimeRange, fetchGainers]);
  useEffect(() => {
    fetchLosers(losersTimeRange);
  }, [losersTimeRange, fetchLosers]);

  // Search
  const filteredEntries = searchQuery
    ? (entriesWithAvatars.length > 0 ? entriesWithAvatars : entries).filter(e => e.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : (entriesWithAvatars.length > 0 ? entriesWithAvatars : entries);

  // Live status
  const isLive = (() => {
    try {
      const lastUpdateTime = new Date(lastUpdate).getTime();
      const now = Date.now();
      return now - lastUpdateTime < 5 * 60 * 1000;
    } catch {
      return false;
    }
  })();

  // Invalidate cache on refresh
  const latestGainersTimeRange = useRef(gainersTimeRange);
  const latestLosersTimeRange = useRef(losersTimeRange);
  useEffect(() => { latestGainersTimeRange.current = gainersTimeRange; }, [gainersTimeRange]);
  useEffect(() => { latestLosersTimeRange.current = losersTimeRange; }, [losersTimeRange]);
  const refresh = useCallback(() => {
    gainersCache.current = {};
    losersCache.current = {};
    manualRefresh();
  }, [manualRefresh]);

  // Smart refresh with cache
  const refreshLeaderboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      // Keep showing current data while fetching new data
      const newEntries = await leaderboardService.getCurrentLeaderboardWithChanges();
      // Only update if data actually changed - use functional update to avoid dependency
      setEntries(prevEntries => {
        const hasChanges = JSON.stringify(prevEntries) !== JSON.stringify(newEntries);
        if (hasChanges) {
          setPreviousEntries(prevEntries);
          return newEntries;
        }
        return prevEntries;
      });
      // Optionally: trigger animations for changes
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, []); // Remove entries dependency

  // Supabase trigger subscription for Lua script coordination
  useEffect(() => {
    const channel = setupCacheInvalidationListener(supabase);

    // Listen for cache invalidation events
    const handleCacheInvalidation = () => {
      console.log('📡 Cache invalidated, fetching fresh data');
      fetchLeaderboard(true); // Force fresh fetch
    };
    window.addEventListener('leaderboard_data_updated', handleCacheInvalidation);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('leaderboard_data_updated', handleCacheInvalidation);
    };
  }, [fetchLeaderboard]);

  // Setup cache invalidation listener for gainers/losers
  useEffect(() => {
    const channel = setupGainersLosersCacheInvalidation(supabase);
    const handleCacheCleared = () => {
      console.log('📡 Gainers/losers cache cleared, will fetch fresh data on next request');
      // Note: Don't fetch immediately, let user interactions trigger fetches
    };
    window.addEventListener('gainers_losers_cache_cleared', handleCacheCleared);
    return () => {
      channel.unsubscribe();
      window.removeEventListener('gainers_losers_cache_cleared', handleCacheCleared);
    };
  }, []);

  const handleGainersTimeRangeChange = (newTimeRange: string) => {
    setGainersTimeRange(newTimeRange as TimeRange);
    fetchGainers(newTimeRange, false); // false = allow cache
  };

  const handleLosersTimeRangeChange = (newTimeRange: string) => {
    setLosersTimeRange(newTimeRange as TimeRange);
    fetchLosers(newTimeRange, false); // false = allow cache
  };

  return {
    entries: entriesWithAvatars.length > 0 ? entriesWithAvatars : entries,
    previousEntries,
    isLoading,
    isInitialLoading,
    error,
    lastUpdate,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    isLive,
    isRefreshing,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
    // Gainers/losers
    gainers,
    losers,
    gainersTimeRange,
    setGainersTimeRange: setGainersTimeRangeDebounced,
    losersTimeRange,
    setLosersTimeRange: setLosersTimeRangeDebounced,
    isLoadingGainers,
    isLoadingLosers,
    filteredEntries,
    lastInsightsUpdate,
    isUsingCache,
    getCacheAge,
    clearLeaderboardCache: clearAllLeaderboardCache
  };
};

export const useCurrentlyRanking = () => {
  const [currentlyRanking, setCurrentlyRanking] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(false);

  // Track if Currently Ranking tab is currently visible/active
  const setTabVisibility = (visible: boolean) => {
    setIsTabVisible(visible);
    console.log(`👁️ Currently Ranking tab visibility: ${visible ? 'visible' : 'hidden'}`);
  };

  // Listen for cache cleared events
  useEffect(() => {
    const handleCacheCleared = () => {
      console.log('🔄 Currently ranking cache cleared event received');
      
      // ONLY auto-refresh if user is actively viewing this tab
      if (isTabVisible) {
        console.log('👁️ User actively viewing Currently Ranking, auto-refreshing');
        setCacheStatus('refreshing');
        
        fetchCurrentlyRanking(true).then(() => {
          console.log('✅ Auto-refreshed for active viewer');
          setCacheStatus('fresh');
        }).catch((error) => {
          console.error('❌ Auto-refresh failed:', error);
          setCacheStatus('error');
        });
      } else {
        console.log('👤 User not viewing Currently Ranking, skipping auto-refresh');
        setCacheStatus('expired');
        // Clear the current data to force a fresh fetch on next interaction
        setCurrentlyRanking([]);
        setIsUsingCache(false);
      }
    };

    window.addEventListener('currently_ranking_cache_cleared', handleCacheCleared);
    
    return () => {
      window.removeEventListener('currently_ranking_cache_cleared', handleCacheCleared);
    };
  }, [isTabVisible]);

  const fetchCurrentlyRanking = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      setCacheStatus(null);

      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = getCachedCurrentlyRanking();
        if (cachedData) {
          setIsUsingCache(true);
          setCurrentlyRanking(cachedData);
          const status = getCurrentlyRankingCacheStatus();
          setCacheStatus(status.hasCache ? 'Cached' : null);
          setIsLoading(false);
          console.log('🔥 Using cached currently ranking data');
          return cachedData;
        }
      }

      // Fetch fresh data from Supabase
      setIsUsingCache(false);
      console.log('🔄 Fetching fresh currently ranking data from Supabase');
      const freshData = await getCurrentlyRankingPlayers();
      
      // Cache the fresh data
      setCachedCurrentlyRanking(freshData);
      setCurrentlyRanking(freshData);
      const status = getCurrentlyRankingCacheStatus();
      setCacheStatus(status.hasCache ? 'Cached' : null);
      setIsLoading(false);
      
      console.log('✅ Fetched and cached currently ranking data');
      return freshData;
    } catch (error) {
      console.error('❌ Error fetching currently ranking data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch currently ranking data');
      setIsLoading(false);
      return [];
    }
  }, []);

  const refresh = useCallback(() => {
    return fetchCurrentlyRanking(true);
  }, [fetchCurrentlyRanking]);

  return {
    currentlyRanking,
    isLoading,
    error,
    isUsingCache,
    cacheStatus,
    fetchCurrentlyRanking,
    refresh,
    setTabVisibility,
    isTabVisible
  };
}; 