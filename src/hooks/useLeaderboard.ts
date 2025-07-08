import { useState, useEffect, useCallback, useRef } from 'react';
import { leaderboardService } from '../services/leaderboardService';
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
  getCacheAge
} from '../utils/leaderboardCache';

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
  const fetchGainers = useCallback(async (timeRange: string) => {
    console.log('📈 FETCHING GAINERS for timeRange:', timeRange, 'at', new Date().toISOString());
    if (gainersCache.current[timeRange]) {
      console.log('📈 GAINERS loaded from cache for timeRange:', timeRange);
      setGainers(gainersCache.current[timeRange]);
      // Set last update from cache if available
      if (gainersCache.current[timeRange].length > 0) {
        setLastInsightsUpdate(gainersCache.current[timeRange][0].change_timestamp);
      }
      return;
    }
    setIsLoadingGainers(true);
    try {
      const data = await leaderboardService.getRPGainers(timeRange);
      gainersCache.current[timeRange] = data;
      setGainers(data || []);
      if (data && data.length > 0) {
        setLastInsightsUpdate(data[0].change_timestamp);
      }
    } catch (err) {
      setGainers([]);
    } finally {
      setIsLoadingGainers(false);
    }
  }, []);

  const fetchLosers = useCallback(async (timeRange: string) => {
    console.log('📉 FETCHING LOSERS for timeRange:', timeRange, 'at', new Date().toISOString());
    if (losersCache.current[timeRange]) {
      console.log('📉 LOSERS loaded from cache for timeRange:', timeRange);
      setLosers(losersCache.current[timeRange]);
      // Set last update from cache if available
      if (losersCache.current[timeRange].length > 0) {
        setLastInsightsUpdate(losersCache.current[timeRange][0].change_timestamp);
      }
      return;
    }
    setIsLoadingLosers(true);
    try {
      const data = await leaderboardService.getRPLosers(timeRange);
      losersCache.current[timeRange] = data;
      setLosers(data || []);
      if (data && data.length > 0) {
        setLastInsightsUpdate(data[0].change_timestamp);
      }
    } catch (err) {
      setLosers([]);
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