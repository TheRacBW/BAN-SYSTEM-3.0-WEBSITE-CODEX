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

  // Fetch main leaderboard with changes
  const fetchLeaderboard = useCallback(async () => {
    if (isInitialLoading) setIsLoading(true);
    setError(null);
    try {
      const newEntries = await leaderboardService.getCurrentLeaderboardWithChanges();
      setPreviousEntries(entries);
      setEntries(newEntries);
      // Get last update time
      const stats = await leaderboardService.getLeaderboardStats();
      setLastUpdate(stats.lastUpdated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard data');
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, [entries, isInitialLoading]);

  // Progressive loading: fetch leaderboard, then enrich avatars in background
  const fetchLeaderboardProgressive = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Fetch core leaderboard data (fast)
      const coreEntries = await leaderboardService.fetchLeaderboardData();
      console.log('[Leaderboard] Raw leaderboard data:', coreEntries);
      const coreWithChanges = coreEntries.map(toWithChanges);
      setEntries(coreWithChanges);
      setEntriesWithAvatars(coreWithChanges); // Show immediately
      setIsInitialLoading(false);
      setIsLoading(false);

      // Step 2: Batch load user IDs and cached avatars using bright-function
      const usernames = coreWithChanges.map(entry => entry.username);
      const lookupResults = await lookupRobloxUserIds(usernames);
      console.log('[Leaderboard] Username lookup results (bright-function):', lookupResults);
      // Build a mapping from username (case-insensitive) to { user_id, profile_picture_url }
      const userIdMap = new Map<string, { user_id: number | null, profile_picture_url: string | null }>();
      lookupResults.forEach(result => {
        let userId: number | null = null;
        if (typeof result.user_id === 'number') {
          userId = result.user_id;
        } else if (typeof result.user_id === 'string' && !isNaN(Number(result.user_id))) {
          userId = Number(result.user_id);
        }
        // Accept profile_picture_url if present
        const profile_picture_url = (result as any).profile_picture_url ?? null;
        const key = result.username.toLowerCase();
        console.log('[Leaderboard] Mapping username:', result.username, '→', key, 'user_id:', userId, 'profile_picture_url:', profile_picture_url);
        userIdMap.set(key, { user_id: userId, profile_picture_url });
      });
      console.log('[Leaderboard] Built userIdMap:', userIdMap);

      // Step 3: Update entries with user IDs and cached avatars (case-insensitive match)
      const entriesWithUserIds = coreWithChanges.map(entry => {
        const key = entry.username.toLowerCase();
        const mapped = userIdMap.get(key);
        if (!mapped) {
          console.warn('[Leaderboard] No mapping found for username:', entry.username, 'key:', key);
        }
        return {
          ...entry,
          user_id: mapped?.user_id ?? entry.user_id ?? null,
          profile_picture: mapped?.profile_picture_url ?? null
        };
      });
      console.log('[Leaderboard] entriesWithUserIds:', entriesWithUserIds);
      setEntriesWithAvatars(entriesWithUserIds);

      // Step 4: Load/fallback avatars for missing or failed images
      const entriesNeedingProxy = entriesWithUserIds.filter(e => !e.profile_picture || e.profile_picture === '' || e.profile_picture === null);
      if (entriesNeedingProxy.length > 0) {
        console.log('[Avatar Proxy] Fetching avatars for uncached/missing:', entriesNeedingProxy.map(e => e.username));
        const pictureMap = new Map<number, { imageUrl: string, targetId: number }>();
        await Promise.all(entriesNeedingProxy.map(async (entry) => {
          if (typeof entry.user_id !== 'number' || isNaN(entry.user_id)) return;
          try {
            const url = `${ROBLOX_THUMBNAIL_PROXY}?userIds=${entry.user_id}&size=150x150&format=Png&isCircular=true`;
            console.log('[Avatar Proxy] Fetching avatar for userId:', entry.user_id, 'URL:', url);
            const response = await fetch(url);
            const raw = await response.clone().text();
            if (response.ok) {
              const data = await response.json();
              console.log('[Avatar Proxy] Response for userId', entry.user_id, ':', data);
              const imageUrl = data.data?.[0]?.imageUrl || '/default-avatar.svg';
              const targetId = data.data?.[0]?.targetId || entry.user_id;
              console.log('[Avatar Proxy] Extracted imageUrl:', imageUrl, 'targetId:', targetId);
              pictureMap.set(entry.user_id, { imageUrl, targetId });
            } else {
              console.warn('[Avatar Proxy] Non-OK response for userId', entry.user_id, ':', raw);
              pictureMap.set(entry.user_id, { imageUrl: '/default-avatar.svg', targetId: entry.user_id });
            }
          } catch (err) {
            console.error('[Avatar Proxy] Error fetching avatar for userId', entry.user_id, ':', err);
            pictureMap.set(entry.user_id, { imageUrl: '/default-avatar.svg', targetId: entry.user_id });
          }
        }));
        const fullyEnrichedEntries = entriesWithUserIds.map(entry => {
          if (!entry.profile_picture || entry.profile_picture === '' || entry.profile_picture === null) {
            if (typeof entry.user_id === 'number' && pictureMap.has(entry.user_id)) {
              const { imageUrl, targetId } = pictureMap.get(entry.user_id)!;
              console.log('[Avatar Proxy] Setting fallback img src for', entry.username, ':', imageUrl, 'and user_id:', targetId);
              return {
                ...entry,
                profile_picture: imageUrl,
                user_id: targetId // Use the proxy's targetId for profile links
              };
            }
            return {
              ...entry,
              profile_picture: '/default-avatar.svg'
            };
          }
          return entry;
        });
        setEntriesWithAvatars(fullyEnrichedEntries);
      } else {
        console.log('[Avatar Proxy] All avatars loaded from cache, no proxy calls needed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard data');
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, []);

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
    fetchLeaderboardProgressive();
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
  const refresh = useCallback(() => {
    gainersCache.current = {};
    losersCache.current = {};
    fetchLeaderboard();
    fetchGainers(gainersTimeRange);
    fetchLosers(losersTimeRange);
  }, [fetchLeaderboard, fetchGainers, fetchLosers, gainersTimeRange, losersTimeRange]);

  // Smart refresh with cache
  const refreshLeaderboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      // Keep showing current data while fetching new data
      const newEntries = await leaderboardService.getCurrentLeaderboardWithChanges();
      // Only update if data actually changed
      const hasChanges = JSON.stringify(entries) !== JSON.stringify(newEntries);
      if (hasChanges) {
        setPreviousEntries(entries);
        setEntries(newEntries);
        // Optionally: trigger animations for changes
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
      setIsInitialLoading(false);
    }
  }, [entries]);

  // Supabase trigger subscription for Lua script coordination
  useEffect(() => {
    const subscription = supabase
      .channel('leaderboard_refresh')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leaderboard_refresh_trigger'
      }, (payload) => {
        console.log('Lua script completed, refreshing leaderboard...');
        refreshLeaderboard(true); // Silent refresh
      })
      .subscribe();
    return () => {
      subscription.unsubscribe();
    };
  }, [refreshLeaderboard]);

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
    lastInsightsUpdate
  };
}; 