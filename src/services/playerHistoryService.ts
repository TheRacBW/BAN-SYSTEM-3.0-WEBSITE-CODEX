import { supabase } from '../lib/supabase';
import type { RPChangeEntry } from '../types/leaderboard';

export const fetchPlayerHistory = async (username: string): Promise<RPChangeEntry[]> => {
  const { data, error } = await supabase
    .from('rp_changes')
    .select('*')
    .eq('username', username)
    .order('change_timestamp', { ascending: true });

  if (error) throw error;
  return data || [];
};

const playerHistoryCache = new Map<string, { data: RPChangeEntry[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export const fetchPlayerHistoryWithCache = async (username: string): Promise<RPChangeEntry[]> => {
  const cached = playerHistoryCache.get(username);
  const now = Date.now();
  if (cached && (now - cached.timestamp) < CACHE_DURATION) return cached.data;
  const data = await fetchPlayerHistory(username);
  playerHistoryCache.set(username, { data, timestamp: now });
  return data;
}; 