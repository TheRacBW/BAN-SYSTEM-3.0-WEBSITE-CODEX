import { useState, useEffect, useCallback } from 'react';
import { leaderboardService } from '../services/leaderboardService';
import { robloxApi } from '../services/robloxApi';
import {
  LeaderboardEntryWithChanges,
  RPChangeWithTimeRange,
  LeaderboardState,
  TabType,
  TimeRange
} from '../types/leaderboard';
import { supabase } from '../lib/supabase';

const DEFAULT_TIME_RANGE: TimeRange = '12h';

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
      const coreWithChanges = coreEntries.map(toWithChanges);
      setEntries(coreWithChanges);
      setEntriesWithAvatars(coreWithChanges); // Show immediately
      setIsInitialLoading(false);
      setIsLoading(false);

      // Step 2: Enrich avatars in background (batch, non-blocking)
      robloxApi.enrichLeaderboardEntries(coreWithChanges).then((enrichedEntries) => {
        setEntriesWithAvatars(enrichedEntries);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard data');
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  }, []);

  // Fetch gainers/losers for a time range
  const fetchGainers = useCallback(async (timeRange: string) => {
    setIsLoadingGainers(true);
    try {
      const data = await leaderboardService.getRPGainers(timeRange);
      setGainers(data);
    } catch (err) {
      setGainers([]);
    } finally {
      setIsLoadingGainers(false);
    }
  }, []);
  const fetchLosers = useCallback(async (timeRange: string) => {
    console.log('🔄 FETCHING LOSERS...');
    setIsLoadingLosers(true);
    try {
      const data = await leaderboardService.getRPLosers(timeRange);
      console.log('🔄 LOSERS QUERY RESULT:', data);
      console.log('🔄 LOSERS COUNT:', data?.length);
      // Patch: calculate current_rp if missing
      const processed = (data || []).map(loser => ({
        ...loser,
        current_rp: loser.current_rp !== undefined ? loser.current_rp : (loser.previous_rp ?? 0) + (loser.rp_change ?? 0)
      }));
      setLosers(processed);
    } catch (err) {
      setLosers([]);
    } finally {
      setIsLoadingLosers(false);
    }
  }, []);

  // Auto-refresh
  const startAutoRefresh = useCallback(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    const interval = setInterval(() => {
      setIsRefreshing(true);
      fetchLeaderboard().finally(() => setIsRefreshing(false));
    }, 300000); // 5 minutes
    setRefreshInterval(interval);
  }, [fetchLeaderboard, refreshInterval]);
  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    setRefreshInterval(null);
  }, [refreshInterval]);

  // Initial fetch
  useEffect(() => {
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
    ? entries.filter(e => e.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

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

  // Manual refresh
  const refresh = useCallback(() => {
    fetchLeaderboard();
    fetchGainers(gainersTimeRange);
    fetchLosers(losersTimeRange);
  }, [fetchLeaderboard, fetchGainers, fetchLosers]);

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
    setGainersTimeRange,
    losersTimeRange,
    setLosersTimeRange,
    isLoadingGainers,
    isLoadingLosers,
    filteredEntries
  };
}; 