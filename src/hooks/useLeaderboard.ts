import { useState, useEffect, useCallback, useMemo } from 'react';
import { LeaderboardState, TabType, LeaderboardEntry, LeaderboardStats } from '../types/leaderboard';
import { leaderboardService } from '../services/leaderboardService';
import { calculateRankFromRPCached, isValidRP, CalculatedRank } from '../utils/rankingSystem';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export const useLeaderboard = () => {
  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    hottestGainers: [],
    biggestLosers: [],
    lastUpdate: '',
    isLoading: false,
    error: null,
    searchQuery: '',
    activeTab: 'main'
  });

  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  /**
   * Fetch leaderboard data with comprehensive error handling
   */
  const fetchLeaderboardData = useCallback(async () => {
    try {
      console.log('🔄 Starting leaderboard data fetch...');
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch main leaderboard data
      const entries = await leaderboardService.fetchLeaderboardData();
      console.log('✅ Fetched', entries.length, 'leaderboard entries');

      // Fetch RP changes for gainers/losers
      const [hottestGainers, biggestLosers] = await Promise.all([
        leaderboardService.getHottestGainers(),
        leaderboardService.getBiggestLosers()
      ]);

      console.log('✅ Fetched', hottestGainers.length, 'hottest gainers');
      console.log('✅ Fetched', biggestLosers.length, 'biggest losers');

      // Get last update time
      const stats = await leaderboardService.getLeaderboardStats();
      const lastUpdate = stats.lastUpdated;

      setState(prev => ({
        ...prev,
        entries,
        hottestGainers: hottestGainers.map(change => ({
          username: change.username,
          total_gain: change.rp_change,
          profile_picture: null, // Will be enriched later
          user_id: null
        })),
        biggestLosers: biggestLosers.map(change => ({
          username: change.username,
          total_loss: Math.abs(change.rp_change),
          profile_picture: null, // Will be enriched later
          user_id: null
        })),
        lastUpdate,
        isLoading: false,
        error: null
      }));

      console.log('✅ Leaderboard state updated successfully');
    } catch (error) {
      console.error('💥 Error fetching leaderboard data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch leaderboard data'
      }));
    }
  }, []);

  /**
   * Search leaderboard by username
   */
  const searchLeaderboard = useCallback(async (query: string) => {
    try {
      console.log('🔍 Searching leaderboard for:', query);
      setState(prev => ({ ...prev, isLoading: true, error: null, searchQuery: query }));

      const entries = await leaderboardService.searchLeaderboard(query);
      console.log('✅ Search results:', entries.length, 'entries');

      setState(prev => ({
        ...prev,
        entries,
        isLoading: false,
        error: null
      }));
    } catch (error) {
      console.error('💥 Search error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }));
    }
  }, []);

  /**
   * Change active tab
   */
  const setActiveTab = useCallback((tab: TabType) => {
    console.log('📑 Switching to tab:', tab);
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  /**
   * Clear search and reload main leaderboard
   */
  const clearSearch = useCallback(() => {
    console.log('🧹 Clearing search and reloading main leaderboard');
    setState(prev => ({ ...prev, searchQuery: '' }));
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  /**
   * Start auto-refresh
   */
  const startAutoRefresh = useCallback(() => {
    console.log('🔄 Starting auto-refresh (30 seconds)');
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing leaderboard data...');
      fetchLeaderboardData();
    }, 30000); // 30 seconds
    
    setRefreshInterval(interval);
  }, [fetchLeaderboardData, refreshInterval]);

  /**
   * Stop auto-refresh
   */
  const stopAutoRefresh = useCallback(() => {
    console.log('⏹️ Stopping auto-refresh');
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [refreshInterval]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Initial data fetch
  useEffect(() => {
    console.log('🚀 Initial leaderboard data fetch');
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Start auto-refresh on mount
  useEffect(() => {
    console.log('🔄 Starting auto-refresh on mount');
    startAutoRefresh();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up auto-refresh on unmount');
      stopAutoRefresh();
    };
  }, [startAutoRefresh, stopAutoRefresh]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('📊 Leaderboard state updated:', {
      entriesCount: state.entries.length,
      isLoading: state.isLoading,
      error: state.error,
      searchQuery: state.searchQuery,
      activeTab: state.activeTab,
      lastUpdate: state.lastUpdate
    });
  }, [state]);

  // Filter entries based on search query
  const filteredEntries = state.searchQuery
    ? state.entries.filter(entry =>
        entry.username.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.entries;

  // Filter gainers and losers based on search query
  const filteredGainers = state.searchQuery
    ? state.hottestGainers.filter(entry =>
        entry.username.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.hottestGainers;

  const filteredLosers = state.searchQuery
    ? state.biggestLosers.filter(entry =>
        entry.username.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.biggestLosers;

  // Check if data is live (updated within last 5 minutes)
  const isLive = (() => {
    try {
      const lastUpdateTime = new Date(state.lastUpdate).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      return now - lastUpdateTime < fiveMinutes;
    } catch (error) {
      console.warn('Error checking if data is live:', error);
      return false;
    }
  })();

  // Get current data based on active tab
  const getCurrentData = () => {
    switch (state.activeTab) {
      case 'gainers':
        return filteredGainers;
      case 'losers':
        return filteredLosers;
      default:
        return filteredEntries;
    }
  };

  // Get rank statistics
  const getRankStatistics = () => {
    const rankCounts = new Map<string, number>();
    
    state.entries.forEach(entry => {
      const rankKey = entry.calculatedRank?.calculatedRank || entry.rank_title || 'Unknown';
      rankCounts.set(rankKey, (rankCounts.get(rankKey) || 0) + 1);
    });
    
    return Array.from(rankCounts.entries()).map(([rank, count]) => ({
      rank,
      count
    }));
  };

  return {
    entries: filteredEntries,
    hottestGainers: filteredGainers,
    biggestLosers: filteredLosers,
    lastUpdate: state.lastUpdate,
    isLoading: state.isLoading,
    error: state.error,
    searchQuery: state.searchQuery,
    activeTab: state.activeTab,
    isLive,
    searchLeaderboard,
    setActiveTab,
    clearSearch,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
    isRefreshing: !!refreshInterval,
    getCurrentData,
    getRankStatistics
  };
}; 