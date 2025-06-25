import { supabase } from '../lib/supabase';
import { robloxApi } from './robloxApi';
import { calculateRankFromRP, getProgressToNextTier } from '../utils/rankingSystem';
import { LeaderboardEntry, RPChange, LeaderboardEntryWithChanges, RPChangeWithTimeRange, TimeRange } from '../types/leaderboard';

// --- Rank Sorting Utility ---
function getRankSortValue(rankTitle: string, rp: number): number {
  console.log('Sorting rank_title from DB:', rankTitle); // Debug log
  const rankMapping: Record<string, number> = {
    'Nightmare': 8000, 'NIGHTMARE': 8000,
    'Emerald': 7000, 'EMERALD': 7000,
    'Diamond 3': 6003, 'DIAMOND 3': 6003,
    'Diamond 2': 6002, 'DIAMOND 2': 6002,
    'Diamond 1': 6001, 'DIAMOND 1': 6001,
    'Platinum 4': 5004, 'PLATINUM 4': 5004,
    'Platinum 3': 5003, 'PLATINUM 3': 5003,
    'Platinum 2': 5002, 'PLATINUM 2': 5002,
    'Platinum 1': 5001, 'PLATINUM 1': 5001,
    'Gold 4': 4004, 'GOLD 4': 4004,
    'Gold 3': 4003, 'GOLD 3': 4003,
    'Gold 2': 4002, 'GOLD 2': 4002,
    'Gold 1': 4001, 'GOLD 1': 4001,
    'Silver 4': 3004, 'SILVER 4': 3004,
    'Silver 3': 3003, 'SILVER 3': 3003,
    'Silver 2': 3002, 'SILVER 2': 3002,
    'Silver 1': 3001, 'SILVER 1': 3001,
    'Bronze 4': 2004, 'BRONZE 4': 2004,
    'Bronze 3': 2003, 'BRONZE 3': 2003,
    'Bronze 2': 2002, 'BRONZE 2': 2002,
    'Bronze 1': 2001, 'BRONZE 1': 2001
  };
  const baseValue = rankMapping[rankTitle];
  if (!baseValue) {
    console.error('❌ UNKNOWN RANK TITLE:', rankTitle);
    return 0;
  }
  const rpBonus = Math.min(rp, 999);
  return baseValue + rpBonus;
}

// Helper to ensure rank_change_direction is typed correctly
function toRankChangeDirection(val: any): 'up' | 'down' | 'same' {
  if (val === 'up' || val === 1) return 'up';
  if (val === 'down' || val === -1) return 'down';
  if (val === 'same' || val === 0) return 'same';
  if (typeof val === 'string') {
    if (val.toLowerCase().includes('up')) return 'up';
    if (val.toLowerCase().includes('down')) return 'down';
    if (val.toLowerCase().includes('same')) return 'same';
  }
  return 'same';
}

class LeaderboardService {
  private previousSnapshot: LeaderboardEntry[] = [];

  /**
   * Fetch all leaderboard data with comprehensive debugging
   */
  async fetchLeaderboardData(): Promise<LeaderboardEntry[]> {
    try {
      console.log('🔍 Starting leaderboard data fetch...');
      // Only fetch from leaderboard table (no information_schema)
      console.log('📊 Fetching from leaderboard table...');
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard')
        .select('*')
        .limit(200);

      if (leaderboardError) {
        console.error('❌ Leaderboard table error:', leaderboardError);
        throw new Error(`Failed to fetch leaderboard data: ${leaderboardError.message}`);
      }

      console.log('📈 Raw leaderboard data count:', leaderboardData?.length || 0);
      console.log('📈 Sample leaderboard entry:', leaderboardData?.[0]);

      if (!leaderboardData || leaderboardData.length === 0) {
        console.warn('⚠️ No data found in leaderboard table');
        return [];
      }

      // --- CRITICAL: Sort by correct rank hierarchy ---
      // FIX: Use rank_position from DB, do not sort by calculated rank or RP
      const sorted = [...leaderboardData].sort((a, b) => a.rank_position - b.rank_position);

      // Do NOT assign rank_position in the frontend; trust the DB

      // Return sorted, un-enriched data for progressive loading
      return sorted;
    } catch (error) {
      console.error('💥 Leaderboard fetch error:', error);
      throw error;
    }
  }

  /**
   * Process and enrich leaderboard entries
   */
  private async processLeaderboardEntries(rawData: any[]): Promise<LeaderboardEntry[]> {
    console.log('🔄 Processing', rawData.length, 'raw entries...');
    
    const processedEntries: LeaderboardEntry[] = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const rawEntry = rawData[i];
      console.log(`Processing entry ${i + 1}/${rawData.length}:`, rawEntry);
      
      try {
        const processedEntry = await this.processSingleEntry(rawEntry, i + 1);
        if (processedEntry) {
          processedEntries.push(processedEntry);
        }
      } catch (error) {
        console.error(`Failed to process entry ${i + 1}:`, error);
        // Continue with other entries
      }
    }
    
    console.log('✅ Successfully processed', processedEntries.length, 'entries');
    return processedEntries;
  }

  /**
   * Process a single leaderboard entry
   */
  private async processSingleEntry(rawEntry: any, position: number): Promise<LeaderboardEntry | null> {
    try {
      // Validate required fields
      if (!rawEntry.username || typeof rawEntry.rp !== 'number') {
        console.warn('Invalid entry data:', rawEntry);
        return null;
      }

      // Calculate rank from RP (frontend calculation)
      const calculatedRank = calculateRankFromRP(rawEntry.rp);
      const rankProgress = getProgressToNextTier(calculatedRank.displayRP);
      
      console.log(`Entry ${position}: ${rawEntry.username} - RP: ${rawEntry.rp}, Calculated Rank: ${calculatedRank.calculatedRank}`);

      // Create the processed entry
      const processedEntry: LeaderboardEntry = {
        id: rawEntry.id || `entry-${position}`,
        username: rawEntry.username,
        rank_position: position,
        rp: rawEntry.rp,
        rank_title: rawEntry.rank_title || calculatedRank.calculatedRank, // Use raw rank if available, otherwise calculated
        inserted_at: rawEntry.inserted_at || rawEntry.updated_at || new Date().toISOString(),
        profile_picture: rawEntry.profile_picture || null,
        user_id: rawEntry.user_id || null,
        // Legacy fields for backward compatibility
        calculated_rank_tier: calculatedRank.tier,
        calculated_rank_number: calculatedRank.level,
        display_rp: calculatedRank.displayRP,
        total_rp: calculatedRank.totalRP,
        // New frontend-calculated field
        calculatedRank
      };

      // Try to enrich with Roblox data if we don't have it
      if (!processedEntry.user_id || !processedEntry.profile_picture) {
        try {
          console.log(`Enriching ${rawEntry.username} with Roblox data...`);
          const enrichedEntry = await robloxApi.enrichLeaderboardEntry(processedEntry);
          Object.assign(processedEntry, enrichedEntry);
        } catch (enrichError) {
          console.warn(`Failed to enrich ${rawEntry.username}:`, enrichError);
        }
      }

      return processedEntry;
    } catch (error) {
      console.error(`Error processing entry ${position}:`, error);
      return null;
    }
  }

  /**
   * Fetch RP changes for the last 24 hours
   */
  async fetchRPChanges(): Promise<RPChange[]> {
    try {
      console.log('📊 Fetching RP changes...');
      
      const { data: historyData, error: historyError } = await supabase
        .from('leaderboard_history')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('❌ History fetch error:', historyError);
        return [];
      }

      console.log('📈 History data count:', historyData?.length || 0);

      if (!historyData || historyData.length === 0) {
        console.log('⚠️ No history data found');
        return [];
      }

      // Process RP changes
      const rpChanges = this.processRPChanges(historyData);
      console.log('✅ Processed RP changes:', rpChanges.length);
      
      return rpChanges;
    } catch (error) {
      console.error('💥 RP changes fetch error:', error);
      return [];
    }
  }

  /**
   * Process RP changes from history data
   */
  private processRPChanges(historyData: any[]): RPChange[] {
    const changes: RPChange[] = [];
    const userChanges = new Map<string, any[]>();

    // Group changes by username
    historyData.forEach(entry => {
      if (entry.username) {
        if (!userChanges.has(entry.username)) {
          userChanges.set(entry.username, []);
        }
        userChanges.get(entry.username)!.push(entry);
      }
    });

    // Calculate changes for each user
    userChanges.forEach((entries, username) => {
      if (entries.length >= 2) {
        // Sort by timestamp
        entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const oldest = entries[0];
        const newest = entries[entries.length - 1];
        
        const rpChange = newest.rp - oldest.rp;
        
        if (rpChange !== 0) {
          changes.push({
            username,
            previous_rp: oldest.rp,
            new_rp: newest.rp,
            rp_change: rpChange,
            previous_rank_title: oldest.rank_title,
            new_rank_title: newest.rank_title,
            rank_position_change: (newest.rank_position || 0) - (oldest.rank_position || 0)
          });
        }
      }
    });

    // Sort by absolute RP change
    return changes.sort((a, b) => Math.abs(b.rp_change) - Math.abs(a.rp_change));
  }

  /**
   * Get hottest gainers (biggest RP increases)
   */
  async getHottestGainers(): Promise<RPChange[]> {
    const changes = await this.fetchRPChanges();
    return changes
      .filter(change => change.rp_change > 0)
      .sort((a, b) => b.rp_change - a.rp_change)
      .slice(0, 10);
  }

  /**
   * Get biggest losers (biggest RP decreases)
   */
  async getBiggestLosers(): Promise<RPChange[]> {
    const changes = await this.fetchRPChanges();
    return changes
      .filter(change => change.rp_change < 0)
      .sort((a, b) => a.rp_change - b.rp_change)
      .slice(0, 10);
  }

  /**
   * Search leaderboard by username
   */
  async searchLeaderboard(query: string): Promise<LeaderboardEntry[]> {
    try {
      console.log('🔍 Searching leaderboard for:', query);
      
      if (!query.trim()) {
        return await this.fetchLeaderboardData();
      }

      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .ilike('username', `%${query}%`)
        .order('rp', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Search error:', error);
        return [];
      }

      console.log('📈 Search results count:', data?.length || 0);
      
      if (!data || data.length === 0) {
        return [];
      }

      // Process search results
      const processedEntries = await this.processLeaderboardEntries(data);
      return processedEntries;
    } catch (error) {
      console.error('💥 Search error:', error);
      return [];
    }
  }

  /**
   * Get leaderboard statistics
   */
  async getLeaderboardStats(): Promise<{
    totalPlayers: number;
    averageRP: number;
    topRP: number;
    lastUpdated: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('rp, inserted_at');

      if (error) {
        console.error('❌ Stats fetch error:', error);
        return {
          totalPlayers: 0,
          averageRP: 0,
          topRP: 0,
          lastUpdated: new Date().toISOString()
        };
      }

      if (!data || data.length === 0) {
        return {
          totalPlayers: 0,
          averageRP: 0,
          topRP: 0,
          lastUpdated: new Date().toISOString()
        };
      }

      const totalPlayers = data.length;
      const averageRP = Math.round(data.reduce((sum, entry) => sum + entry.rp, 0) / totalPlayers);
      const topRP = Math.max(...data.map(entry => entry.rp));
      const lastUpdated = data[0]?.inserted_at || new Date().toISOString();

      return {
        totalPlayers,
        averageRP,
        topRP,
        lastUpdated
      };
    } catch (error) {
      console.error('💥 Stats error:', error);
      return {
        totalPlayers: 0,
        averageRP: 0,
        topRP: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Get main leaderboard with live RP/position/rank changes for animation
   */
  async getCurrentLeaderboardWithChanges(): Promise<LeaderboardEntryWithChanges[]> {
    const current = await this.fetchLeaderboardData();
    const previous = this.previousSnapshot;
    const previousMap = new Map(previous.map(e => [e.username, e]));
    const result: LeaderboardEntryWithChanges[] = current.map((entry, idx) => {
      const prev = previousMap.get(entry.username);
      const rp_change = prev ? entry.rp - prev.rp : 0;
      const position_change = prev ? prev.rank_position - entry.rank_position : 0;
      const rank_title_change = prev && prev.rank_title !== entry.rank_title ? `${prev.rank_title} → ${entry.rank_title}` : null;
      const has_changes = !!(rp_change || position_change || rank_title_change);
      return {
        ...entry,
        rp_change,
        position_change,
        rank_title_change,
        has_changes,
        previous_position: prev?.rank_position,
        previous_rp: prev?.rp,
        previous_rank_title: prev?.rank_title
      };
    });
    // Save current as previous for next refresh
    this.previousSnapshot = current;
    return result;
  }

  /**
   * Get RP gainers for a time range using hybrid strategy (optimized RPC, fallback to rp_changes)
   */
  async getRPGainers(timeRange: TimeRange): Promise<RPChangeWithTimeRange[]> {
    const timeframeHours = {
      '6h': 6,
      '12h': 12,
      '1d': 24,
      '2d': 48
    }[timeRange] || 12;
    const limit = 4;
    // --- PRIMARY: Optimized RPC ---
    console.log('[RPC] Calling get_top_gainers_optimized with', timeframeHours, 'hours, limit', limit);
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_gainers_optimized', { hours: timeframeHours, limit });
    console.log('[RPC] Raw RPC result:', { data: rpcData, error: rpcError });
    let gainers: any[] = rpcData || [];
    if (gainers.length >= 3) {
      console.log('[RPC] Using optimized gainers:', gainers);
      const mapped = gainers.map((entry: any) => ({
        username: entry.username,
        current_rp: entry.latest_rp,
        current_rank_title: entry.latest_rank,
        previous_rp: entry.latest_rp - entry.total_rp_gain,
        previous_rank_title: '',
        rp_change: entry.total_rp_gain,
        rank_change_direction: toRankChangeDirection(entry.rank_improvement),
        time_period: timeRange,
        percentage_change: entry.percentage_change,
        profile_picture: entry.profile_picture || null,
        user_id: entry.user_id || null,
        inserted_at: entry.latest_change,
        rank_change_text: entry.rank_improvement ? `↑${entry.rank_improvement}` : '',
        change_count: entry.change_count,
        latest_change: entry.latest_change,
      }));
      console.log('[RPC] Final mapped gainers returned to UI:', mapped);
      return mapped;
    }
    // --- FALLBACK: Direct rp_changes query ---
    console.log('[FALLBACK] Not enough gainers from optimized RPC, using rp_changes fallback');
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('rp_changes')
      .select(`
        username,
        rp_change,
        previous_rp,
        new_calculated_rank,
        rank_change,
        change_timestamp
      `)
      .gt('change_timestamp', new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString())
      .gt('rp_change', 0);
    console.log('[FALLBACK] Raw fallback query result:', { data: fallbackData, error: fallbackError });
    if (fallbackError) {
      console.error('[FALLBACK] rp_changes fetch error:', fallbackError);
      return [];
    }
    // Group and aggregate fallback results
    const grouped: Record<string, any[]> = {};
    (fallbackData || []).forEach((row: any) => {
      if (!grouped[row.username]) grouped[row.username] = [];
      grouped[row.username].push(row);
    });
    const fallbackAggregated = Object.entries(grouped).map(([username, rows]) => {
      const total_rp_gain = rows.reduce((sum, r) => sum + (r.rp_change || 0), 0);
      const rank_improvement = Math.max(...rows.map(r => r.rank_change || 0));
      const latest = rows.reduce((a, b) => new Date(a.change_timestamp) > new Date(b.change_timestamp) ? a : b);
      const min_prev_rp = Math.min(...rows.map(r => r.previous_rp || 0));
      const percentage_change = min_prev_rp === 0 ? null : (total_rp_gain / min_prev_rp) * 100;
      return {
        username,
        total_rp_gain,
        rank_improvement,
        latest_rank: latest.new_calculated_rank,
        change_count: rows.length,
        percentage_change,
        latest_change: latest.change_timestamp,
        latest_rp: latest.previous_rp + total_rp_gain,
      };
    })
      .filter(e => e.total_rp_gain > 0)
      .sort((a, b) => b.total_rp_gain - a.total_rp_gain)
      .slice(0, limit);
    console.log('[FALLBACK] Aggregated fallback gainers:', fallbackAggregated);
    const mapped = fallbackAggregated.map((entry: any) => ({
      username: entry.username,
      current_rp: entry.latest_rp,
      current_rank_title: entry.latest_rank,
      previous_rp: entry.latest_rp - entry.total_rp_gain,
      previous_rank_title: '',
      rp_change: entry.total_rp_gain,
      rank_change_direction: toRankChangeDirection(entry.rank_improvement),
      time_period: timeRange,
      percentage_change: entry.percentage_change,
      profile_picture: null,
      user_id: null,
      inserted_at: entry.latest_change,
      rank_change_text: entry.rank_improvement ? `↑${entry.rank_improvement}` : '',
      change_count: entry.change_count,
      latest_change: entry.latest_change,
    }));
    console.log('[FALLBACK] Final mapped fallback gainers returned to UI:', mapped);
    return mapped;
  }

  /**
   * Get RP losers for a time range using hybrid strategy (optimized RPC, fallback to rp_changes)
   */
  async getRPLosers(timeRange: TimeRange): Promise<RPChangeWithTimeRange[]> {
    const timeframeHours = {
      '6h': 6,
      '12h': 12,
      '1d': 24,
      '2d': 48
    }[timeRange] || 12;
    const limit = 4;
    // --- PRIMARY: Optimized RPC ---
    console.log('[RPC] Calling get_top_losers_optimized with', timeframeHours, 'hours, limit', limit);
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_losers_optimized', { hours: timeframeHours, limit });
    console.log('[RPC] Raw RPC result:', { data: rpcData, error: rpcError });
    let losers: any[] = rpcData || [];
    if (losers.length >= 3) {
      console.log('[RPC] Using optimized losers:', losers);
      const mapped = losers.map((entry: any) => ({
        username: entry.username,
        current_rp: entry.latest_rp,
        current_rank_title: entry.latest_rank,
        previous_rp: entry.latest_rp - entry.total_rp_loss,
        previous_rank_title: '',
        rp_change: entry.total_rp_loss,
        rank_change_direction: toRankChangeDirection(entry.rank_decline),
        time_period: timeRange,
        percentage_change: entry.percentage_change,
        profile_picture: entry.profile_picture || null,
        user_id: entry.user_id || null,
        inserted_at: entry.latest_change,
        rank_change_text: entry.rank_decline ? `↓${entry.rank_decline}` : '',
        change_count: entry.change_count,
        latest_change: entry.latest_change,
      }));
      console.log('[RPC] Final mapped losers returned to UI:', mapped);
      return mapped;
    }
    // --- FALLBACK: Direct rp_changes query ---
    console.log('[FALLBACK] Not enough losers from optimized RPC, using rp_changes fallback');
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('rp_changes')
      .select(`
        username,
        rp_change,
        previous_rp,
        new_calculated_rank,
        rank_change,
        change_timestamp
      `)
      .gt('change_timestamp', new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString())
      .lt('rp_change', 0);
    console.log('[FALLBACK] Raw fallback query result:', { data: fallbackData, error: fallbackError });
    if (fallbackError) {
      console.error('[FALLBACK] rp_changes fetch error:', fallbackError);
      return [];
    }
    // Group and aggregate fallback results
    const grouped: Record<string, any[]> = {};
    (fallbackData || []).forEach((row: any) => {
      if (!grouped[row.username]) grouped[row.username] = [];
      grouped[row.username].push(row);
    });
    const fallbackAggregated = Object.entries(grouped).map(([username, rows]) => {
      const total_rp_loss = rows.reduce((sum, r) => sum + (r.rp_change || 0), 0);
      const rank_decline = Math.min(...rows.map(r => r.rank_change || 0));
      const latest = rows.reduce((a, b) => new Date(a.change_timestamp) > new Date(b.change_timestamp) ? a : b);
      const min_prev_rp = Math.min(...rows.map(r => r.previous_rp || 0));
      const percentage_change = min_prev_rp === 0 ? null : (total_rp_loss / min_prev_rp) * 100;
      return {
        username,
        total_rp_loss,
        rank_decline,
        latest_rank: latest.new_calculated_rank,
        change_count: rows.length,
        percentage_change,
        latest_change: latest.change_timestamp,
        latest_rp: latest.previous_rp + total_rp_loss,
      };
    })
      .filter(e => e.total_rp_loss < 0)
      .sort((a, b) => a.total_rp_loss - b.total_rp_loss)
      .slice(0, limit);
    console.log('[FALLBACK] Aggregated fallback losers:', fallbackAggregated);
    const mapped = fallbackAggregated.map((entry: any) => ({
      username: entry.username,
      current_rp: entry.latest_rp,
      current_rank_title: entry.latest_rank,
      previous_rp: entry.latest_rp - entry.total_rp_loss,
      previous_rank_title: '',
      rp_change: entry.total_rp_loss,
      rank_change_direction: toRankChangeDirection(entry.rank_decline),
      time_period: timeRange,
      percentage_change: entry.percentage_change,
      profile_picture: null,
      user_id: null,
      inserted_at: entry.latest_change,
      rank_change_text: entry.rank_decline ? `↓${entry.rank_decline}` : '',
      change_count: entry.change_count,
      latest_change: entry.latest_change,
    }));
    console.log('[FALLBACK] Final mapped fallback losers returned to UI:', mapped);
    return mapped;
  }

  /**
   * Legacy method for backward compatibility
   */
  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.fetchLeaderboardData();
  }

  /**
   * Fetch official rank icons from Supabase account_ranks table
   */
  async getRankIcons(): Promise<Map<string, string>> {
    try {
      const { data, error } = await supabase
        .from('account_ranks')
        .select('name, image_url');
      if (error) throw error;
      const rankMap = new Map<string, string>();
      data?.forEach(rank => {
        rankMap.set(rank.name, rank.image_url);
      });
      return rankMap;
    } catch (error) {
      console.error('Failed to fetch rank icons:', error);
      return new Map();
    }
  }
}

export const leaderboardService = new LeaderboardService(); 