import { supabase } from '../lib/supabase';
import { robloxApi } from './robloxApi';
import { calculateRankFromRP, getProgressToNextTier } from '../utils/rankingSystem';
import { LeaderboardEntry, RPChange } from '../types/leaderboard';

class LeaderboardService {
  /**
   * Fetch all leaderboard data with comprehensive debugging
   */
  async fetchLeaderboardData(): Promise<LeaderboardEntry[]> {
    try {
      console.log('🔍 Starting leaderboard data fetch...');
      
      // First, let's check what tables exist and their structure
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (tablesError) {
        console.warn('Could not check tables:', tablesError);
      } else {
        console.log('Available tables:', tables?.map(t => t.table_name));
      }

      // Try to fetch from leaderboard table
      console.log('📊 Fetching from leaderboard table...');
      const { data: leaderboardData, error: leaderboardError } = await supabase
        .from('leaderboard')
        .select('*')
        .order('rp', { ascending: false })
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

      // Process and enrich the data
      console.log('🔄 Processing leaderboard entries...');
      const processedEntries = await this.processLeaderboardEntries(leaderboardData);
      
      console.log('✅ Final processed entries count:', processedEntries.length);
      console.log('✅ Sample processed entry:', processedEntries[0]);
      
      return processedEntries;
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
   * Legacy method for backward compatibility
   */
  async getCurrentLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.fetchLeaderboardData();
  }
}

export const leaderboardService = new LeaderboardService(); 