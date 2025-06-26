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
    console.log('[lookupRobloxUserIds] Looking up usernames:', usernames);
    const { data, error } = await supabase.functions.invoke('bright-function', {
      body: { usernames }
    });
    console.log('[lookupRobloxUserIds] Response from bright-function:', data, error);
    if (error) throw error;
    if (data && Array.isArray(data.results)) {
      console.log('[lookupRobloxUserIds] Results:', data.results);
      return data.results;
    }
    return [];
  } catch (err) {
    console.error('[lookupRobloxUserIds] Error:', err);
    return [];
  }
} 