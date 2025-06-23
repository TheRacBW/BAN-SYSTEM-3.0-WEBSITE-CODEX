import { useState, useEffect, useCallback } from 'react';
import { leaderboardService } from '../services/leaderboardService';
import {
  LeaderboardEntryWithChanges,
  RPChangeWithTimeRange,
  LeaderboardState,
  TabType,
  TimeRange
} from '../types/leaderboard';

const DEFAULT_TIME_RANGE: TimeRange = '12h';

export const useLeaderboard = () => {
  // Main leaderboard
  const [entries, setEntries] = useState<LeaderboardEntryWithChanges[]>([]);
  const [previousEntries, setPreviousEntries] = useState<LeaderboardEntryWithChanges[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  // Fetch main leaderboard with changes
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
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
    }
  }, [entries]);

  // Fetch gainers/losers for a time range
  const fetchGainers = useCallback(async (timeRange: TimeRange) => {
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
  const fetchLosers = useCallback(async (timeRange: TimeRange) => {
    setIsLoadingLosers(true);
    try {
      const data = await leaderboardService.getRPLosers(timeRange);
      setLosers(data);
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
    }, 30000);
    setRefreshInterval(interval);
  }, [fetchLeaderboard, refreshInterval]);
  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    setRefreshInterval(null);
  }, [refreshInterval]);

  // Initial fetch
  useEffect(() => {
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
  }, [fetchLeaderboard, fetchGainers, fetchLosers, gainersTimeRange, losersTimeRange]);

  return {
    entries: filteredEntries,
    previousEntries,
    isLoading,
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
    isLoadingLosers
  };
}; 