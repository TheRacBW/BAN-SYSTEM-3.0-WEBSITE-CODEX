import { supabase } from './supabase';

export interface RobloxUserLookupResult {
  username: string;
  user_id: string | number | null;
  cached: boolean;
}

/**
 * Looks up Roblox user IDs for a batch of usernames using the bright-function Edge Function.
 * @param usernames Array of Roblox usernames
 * @returns Array of { username, user_id, cached }
 */
export async function lookupRobloxUserIds(usernames: string[]): Promise<RobloxUserLookupResult[]> {
  if (!Array.isArray(usernames) || usernames.length === 0) return [];
  try {
    const { data, error } = await supabase.functions.invoke('bright-function', {
      body: { usernames }
    });
    if (error) throw error;
    if (data && Array.isArray(data.results)) {
      return data.results;
    }
    return [];
  } catch (err) {
    // Optionally log error
    return [];
  }
} 