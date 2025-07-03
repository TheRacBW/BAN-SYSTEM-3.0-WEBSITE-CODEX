import { useState, useEffect } from 'react';
import { fetchPlayerHistoryWithCache } from '../services/playerHistoryService';
import type { RPChangeEntry, PlayerStats } from '../types/leaderboard';

function calculatePlayerStats(history: RPChangeEntry[]): PlayerStats {
  return {
    totalGames: history.length,
    totalRPGained: history.reduce((sum, e) => sum + e.rp_change, 0),
    highestRP: Math.max(...history.map(e => e.new_rp)),
    currentRank: history[history.length - 1]?.new_calculated_rank || '',
    promotions: history.filter((e, i) => i > 0 && e.new_calculated_rank !== history[i-1].new_calculated_rank).length,
    avgRPPerGame: history.length ? history.reduce((sum, e) => sum + e.rp_change, 0) / history.length : 0,
    winRate: history.length ? history.filter(e => e.rp_change > 0).length / history.length : 0,
  };
}

export const usePlayerHistory = (username: string, enabled: boolean = false) => {
  const [data, setData] = useState<RPChangeEntry[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !username) return;
    setLoading(true);
    setError(null);
    fetchPlayerHistoryWithCache(username)
      .then(history => {
        setData(history);
        setStats(calculatePlayerStats(history));
      })
      .catch(err => setError(err.message || 'Failed to fetch data'))
      .finally(() => setLoading(false));
  }, [username, enabled]);

  return { data, stats, loading, error };
}; 