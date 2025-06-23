import { useState, useEffect, useCallback, useMemo } from 'react';
import { LeaderboardState, TabType, LeaderboardEntry, LeaderboardStats } from '../types/leaderboard';
import { leaderboardService } from '../services/leaderboardService';
import { calculateRankFromRPCached, isValidRP } from '../utils/rankingSystem';

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
  const filteredEntries = useMemo(() => {
    if (!state.searchQuery.trim()) {
      return state.entries;
    }

    const query = state.searchQuery.toLowerCase();
    return state.entries.filter(entry => {
      // Search by username
      if (entry.username.toLowerCase().includes(query)) {
        return true;
      }

      // Search by calculated rank
      const calculatedRank = entry.calculatedRank || 
        (entry.rp !== undefined ? calculateRankFromRPCached(entry.rp) : null);
      
      if (calculatedRank) {
        const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
        if (rankName.includes(query)) {
          return true;
        }
      }

      // Search by raw rank title (legacy)
      if (entry.rank_title.toLowerCase().includes(query)) {
        return true;
      }

      return false;
    });
  }, [state.entries, state.searchQuery]);

  // Filter gainers/losers based on search query
  const filteredGainers = useMemo(() => {
    if (!state.searchQuery.trim()) {
      return state.hottestGainers;
    }

    const query = state.searchQuery.toLowerCase();
    return state.hottestGainers.filter(gainer => {
      if (gainer.username.toLowerCase().includes(query)) {
        return true;
      }

      const calculatedRank = gainer.calculatedRank || 
        (gainer.total_rp !== undefined ? calculateRankFromRPCached(gainer.total_rp) : null);
      
      if (calculatedRank) {
        const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
        return rankName.includes(query);
      }

      return false;
    });
  }, [state.hottestGainers, state.searchQuery]);

  const filteredLosers = useMemo(() => {
    if (!state.searchQuery.trim()) {
      return state.biggestLosers;
    }

    const query = state.searchQuery.toLowerCase();
    return state.biggestLosers.filter(loser => {
      if (loser.username.toLowerCase().includes(query)) {
        return true;
      }

      const calculatedRank = loser.calculatedRank || 
        (loser.total_rp !== undefined ? calculateRankFromRPCached(loser.total_rp) : null);
      
      if (calculatedRank) {
        const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
        return rankName.includes(query);
      }

      return false;
    });
  }, [state.biggestLosers, state.searchQuery]);

  // Get current data based on active tab
  const getCurrentData = useCallback(() => {
    switch (state.activeTab) {
      case 'gainers':
        return filteredGainers;
      case 'losers':
        return filteredLosers;
      default:
        return filteredEntries;
    }
  }, [state.activeTab, filteredEntries, filteredGainers, filteredLosers]);

  // Check if data is live (updated within last 5 minutes)
  const isLive = useMemo(() => {
    return leaderboardService.isLive(state.lastUpdate);
  }, [state.lastUpdate]);

  // Get rank statistics
  const getRankStatistics = useCallback(async () => {
    try {
      return await leaderboardService.getRankStatistics();
    } catch (error) {
      console.error('Error fetching rank statistics:', error);
      return [];
    }
  }, []);

  // Calculate rank changes for animations
  const getPreviousEntry = useCallback((currentEntry: LeaderboardEntry) => {
    // Find the previous entry by username
    return state.entries.find(entry => entry.username === currentEntry.username);
  }, [state.entries]);

  return {
    ...state,
    entries: filteredEntries,
    hottestGainers: filteredGainers,
    biggestLosers: filteredLosers,
    isLive,
    setSearchQuery,
    setActiveTab,
    refreshData,
    getCurrentData,
    getRankStatistics,
    getPreviousEntry
  };
}; 