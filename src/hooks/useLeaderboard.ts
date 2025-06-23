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
    isLoading: true,
    error: null,
    searchQuery: '',
    activeTab: 'main'
  });

  const fetchData = useCallback(async () => {
    try {
      console.log('Starting data fetch...');
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch data with individual error handling
      let entries: LeaderboardEntry[] = [];
      let gainers: LeaderboardStats[] = [];
      let losers: LeaderboardStats[] = [];
      let lastUpdate = '';

      try {
        console.log('Fetching leaderboard entries...');
        entries = await leaderboardService.getCurrentLeaderboard();
        console.log('Leaderboard entries fetched:', entries.length);
      } catch (error) {
        console.error('Failed to fetch leaderboard entries:', error);
        entries = [];
      }

      try {
        console.log('Fetching hottest gainers...');
        gainers = await leaderboardService.getHottestGainers();
        console.log('Hottest gainers fetched:', gainers.length);
      } catch (error) {
        console.error('Failed to fetch hottest gainers:', error);
        gainers = [];
      }

      try {
        console.log('Fetching biggest losers...');
        losers = await leaderboardService.getBiggestLosers();
        console.log('Biggest losers fetched:', losers.length);
      } catch (error) {
        console.error('Failed to fetch biggest losers:', error);
        losers = [];
      }

      try {
        console.log('Fetching last update time...');
        lastUpdate = await leaderboardService.getLastUpdateTime();
        console.log('Last update time fetched:', lastUpdate);
      } catch (error) {
        console.error('Failed to fetch last update time:', error);
        lastUpdate = new Date().toISOString();
      }

      setState(prev => ({
        ...prev,
        entries,
        hottestGainers: gainers,
        biggestLosers: losers,
        lastUpdate,
        isLoading: false
      }));

      console.log('Data fetch completed successfully');
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
      try {
        // Search by username
        if (entry.username && entry.username.toLowerCase().includes(query)) {
          return true;
        }

        // Search by calculated rank
        let calculatedRank: CalculatedRank | null = null;
        try {
          calculatedRank = entry.calculatedRank || 
            (entry.rp !== undefined ? calculateRankFromRPCached(entry.rp) : null);
        } catch (error) {
          console.warn(`Failed to calculate rank for search for ${entry.username}:`, error);
        }
        
        if (calculatedRank) {
          const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
          if (rankName.includes(query)) {
            return true;
          }
        }

        // Search by raw rank title (legacy)
        if (entry.rank_title && entry.rank_title.toLowerCase().includes(query)) {
          return true;
        }

        return false;
      } catch (error) {
        console.error('Error in search filter for entry:', entry, error);
        return false;
      }
    });
  }, [state.entries, state.searchQuery]);

  // Filter gainers/losers based on search query
  const filteredGainers = useMemo(() => {
    if (!state.searchQuery.trim()) {
      return state.hottestGainers;
    }

    const query = state.searchQuery.toLowerCase();
    return state.hottestGainers.filter(gainer => {
      try {
        if (gainer.username && gainer.username.toLowerCase().includes(query)) {
          return true;
        }

        let calculatedRank: CalculatedRank | null = null;
        try {
          calculatedRank = gainer.calculatedRank || 
            (gainer.total_rp !== undefined ? calculateRankFromRPCached(gainer.total_rp) : null);
        } catch (error) {
          console.warn(`Failed to calculate rank for gainer search for ${gainer.username}:`, error);
        }
        
        if (calculatedRank) {
          const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
          return rankName.includes(query);
        }

        return false;
      } catch (error) {
        console.error('Error in gainer search filter for entry:', gainer, error);
        return false;
      }
    });
  }, [state.hottestGainers, state.searchQuery]);

  const filteredLosers = useMemo(() => {
    if (!state.searchQuery.trim()) {
      return state.biggestLosers;
    }

    const query = state.searchQuery.toLowerCase();
    return state.biggestLosers.filter(loser => {
      try {
        if (loser.username && loser.username.toLowerCase().includes(query)) {
          return true;
        }

        let calculatedRank: CalculatedRank | null = null;
        try {
          calculatedRank = loser.calculatedRank || 
            (loser.total_rp !== undefined ? calculateRankFromRPCached(loser.total_rp) : null);
        } catch (error) {
          console.warn(`Failed to calculate rank for loser search for ${loser.username}:`, error);
        }
        
        if (calculatedRank) {
          const rankName = `${calculatedRank.tier} ${calculatedRank.level}`.toLowerCase();
          return rankName.includes(query);
        }

        return false;
      } catch (error) {
        console.error('Error in loser search filter for entry:', loser, error);
        return false;
      }
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