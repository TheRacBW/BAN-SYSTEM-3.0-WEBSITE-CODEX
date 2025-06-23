import { useState, useEffect, useCallback } from 'react';
import { LeaderboardState, TabType } from '../types/leaderboard';
import { leaderboardService } from '../services/leaderboardService';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export const useLeaderboard = () => {
  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    hottestGainers: [],
    biggestLosers: [],
    lastUpdate: '',
    isLoading: true,
    error: null,
    searchQuery: '',
    activeTab: 'main'
  });

  const fetchData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const [entries, gainers, losers, lastUpdate] = await Promise.all([
        leaderboardService.getCurrentLeaderboard(),
        leaderboardService.getHottestGainers(),
        leaderboardService.getBiggestLosers(),
        leaderboardService.getLastUpdateTime()
      ]);

      setState(prev => ({
        ...prev,
        entries,
        hottestGainers: gainers,
        biggestLosers: losers,
        lastUpdate,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard data',
        isLoading: false
      }));
    }
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setActiveTab = useCallback((tab: TabType) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter entries based on search query
  const filteredEntries = state.entries.filter(entry =>
    entry.username.toLowerCase().includes(state.searchQuery.toLowerCase())
  );

  const isLive = leaderboardService.isLive(state.lastUpdate);

  return {
    ...state,
    filteredEntries,
    isLive,
    setSearchQuery,
    setActiveTab,
    refreshData
  };
}; 