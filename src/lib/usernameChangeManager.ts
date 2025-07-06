import { supabase } from './supabase';
import { leaderboardService } from '../services/leaderboardService';

// TypeScript interfaces for username change management
export interface UsernameChangeData {
  id: string;
  old_username: string;
  new_username: string;
  user_id: number;
  records_updated: number;
  confidence_score?: number;
  merged_at?: string;
  verified: boolean;
  notes?: string;
}

export interface UsernameChangeStatistics {
  totalDetected: number;
  totalMerged: number;
  totalPending: number;
  totalRejected: number;
  averageConfidence: number;
  lastDetectionDate?: string;
  lastMergeDate?: string;
}

export interface BulkMergeResult {
  success: boolean;
  mergedCount: number;
  failedCount: number;
  errors: string[];
  details: {
    successful: string[];
    failed: Array<{ old_username: string; new_username: string; error: string }>;
  };
}

export interface UsernameChangeFilters {
  verified?: boolean;
  minConfidence?: number;
  maxConfidence?: number;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

/**
 * Username change management utilities
 * Handles detection, merging, and statistics for username changes
 */
export class UsernameChangeManager {
  /**
   * Detect username changes using the database function
   */
  async detectUsernameChanges(): Promise<UsernameChangeData[]> {
    try {
      console.log('🔍 Detecting username changes...');
      
      const result = await leaderboardService.detectUsernameChanges();
      
      if (!result || !Array.isArray(result)) {
        console.log('No username changes detected');
        return [];
      }

      // Transform the result into UsernameChangeData format
      const changes: UsernameChangeData[] = result.map((change: any) => ({
        id: change.id || crypto.randomUUID(),
        old_username: change.old_username,
        new_username: change.new_username,
        user_id: change.user_id,
        records_updated: change.records_updated || 0,
        confidence_score: change.confidence_score || 0,
        merged_at: change.merged_at,
        verified: change.verified || false,
        notes: change.notes
      }));

      console.log(`✅ Detected ${changes.length} username changes`);
      return changes;
    } catch (error) {
      console.error('❌ Error detecting username changes:', error);
      throw error;
    }
  }

  /**
   * Get unverified username changes from the database
   */
  async getUnverifiedChanges(filters: UsernameChangeFilters = {}): Promise<UsernameChangeData[]> {
    try {
      console.log('📋 Fetching unverified username changes...');
      
      // First check if the table exists
      const { data: tableExists, error: tableCheckError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'username_change_log')
        .limit(1);

      if (tableCheckError) {
        console.warn('⚠️ Could not check if username_change_log table exists:', tableCheckError);
      }

      // If table doesn't exist, return empty array
      if (!tableExists || tableExists.length === 0) {
        console.log('ℹ️ username_change_log table does not exist yet, returning empty array');
        return [];
      }
      
      let query = supabase
        .from('username_change_log')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.verified !== undefined) {
        query = query.eq('verified', filters.verified);
      }
      
      if (filters.minConfidence !== undefined) {
        query = query.gte('confidence_score', filters.minConfidence);
      }
      
      if (filters.maxConfidence !== undefined) {
        query = query.lte('confidence_score', filters.maxConfidence);
      }
      
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching unverified changes:', error);
        // Return empty array instead of throwing
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} unverified changes`);
      return data || [];
    } catch (error) {
      console.error('❌ Error in getUnverifiedChanges:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Merge a single username change
   */
  async mergeUsernameChange(
    oldUsername: string, 
    newUsername: string, 
    userId: number,
    mergedBy: string = 'system'
  ): Promise<boolean> {
    try {
      console.log(`🔄 Merging username change: ${oldUsername} → ${newUsername} (ID: ${userId})`);
      
      // Call the database function to merge the change
      const { data, error } = await supabase
        .rpc('merge_username_change', {
          p_old_username: oldUsername,
          p_new_username: newUsername,
          p_user_id: userId
        });

      if (error) {
        console.error('❌ Error merging username change:', error);
        throw error;
      }

      // Check if username_change_log table exists before trying to update it
      const { data: tableExists, error: tableCheckError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'username_change_log')
        .limit(1);

      if (tableCheckError) {
        console.warn('⚠️ Could not check if username_change_log table exists:', tableCheckError);
      }

      // Only update the log if the table exists
      if (tableExists && tableExists.length > 0) {
        const { error: updateError } = await supabase
          .from('username_change_log')
          .update({
            verified: true,
            merged_at: new Date().toISOString(),
            notes: `Merged by ${mergedBy}`
          })
          .eq('old_username', oldUsername)
          .eq('new_username', newUsername)
          .eq('user_id', userId);

        if (updateError) {
          console.error('❌ Error updating change log:', updateError);
          // Don't throw here as the merge was successful
        }
      } else {
        console.log('ℹ️ username_change_log table does not exist yet, skipping log update');
      }

      console.log(`✅ Successfully merged username change: ${oldUsername} → ${newUsername}`);
      return true;
    } catch (error) {
      console.error('❌ Error in mergeUsernameChange:', error);
      throw error;
    }
  }

  /**
   * Bulk merge multiple username changes
   */
  async bulkMergeChanges(changes: Array<{ old_username: string; new_username: string; user_id: number }>): Promise<BulkMergeResult> {
    try {
      console.log(`🔄 Bulk merging ${changes.length} username changes...`);
      
      const result: BulkMergeResult = {
        success: true,
        mergedCount: 0,
        failedCount: 0,
        errors: [],
        details: {
          successful: [],
          failed: []
        }
      };

      for (const change of changes) {
        try {
          await this.mergeUsernameChange(
            change.old_username, 
            change.new_username, 
            change.user_id
          );
          
          result.mergedCount++;
          result.details.successful.push(`${change.old_username} → ${change.new_username}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.failedCount++;
          result.errors.push(errorMessage);
          result.details.failed.push({
            old_username: change.old_username,
            new_username: change.new_username,
            error: errorMessage
          });
        }
      }

      if (result.failedCount > 0) {
        result.success = false;
      }

      console.log(`✅ Bulk merge completed: ${result.mergedCount} successful, ${result.failedCount} failed`);
      return result;
    } catch (error) {
      console.error('❌ Error in bulkMergeChanges:', error);
      throw error;
    }
  }

  /**
   * Get statistics about username changes
   */
  async getChangeStatistics(): Promise<UsernameChangeStatistics> {
    try {
      console.log('📊 Fetching username change statistics...');
      
      // First check if the table exists
      const { data: tableExists, error: tableCheckError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'username_change_log')
        .limit(1);

      if (tableCheckError) {
        console.warn('⚠️ Could not check if username_change_log table exists:', tableCheckError);
      }

      // If table doesn't exist, return empty statistics
      if (!tableExists || tableExists.length === 0) {
        console.log('ℹ️ username_change_log table does not exist yet, returning empty statistics');
        return {
          totalDetected: 0,
          totalMerged: 0,
          totalPending: 0,
          totalRejected: 0,
          averageConfidence: 0
        };
      }
      
      // Get total counts by verification status
      const { data: statusCounts, error: statusError } = await supabase
        .from('username_change_log')
        .select('verified, confidence_score, merged_at')
        .order('merged_at', { ascending: false });

      if (statusError) {
        console.error('❌ Error fetching status counts:', statusError);
        // Return empty statistics instead of throwing
        return {
          totalDetected: 0,
          totalMerged: 0,
          totalPending: 0,
          totalRejected: 0,
          averageConfidence: 0
        };
      }

      const stats: UsernameChangeStatistics = {
        totalDetected: 0,
        totalMerged: 0,
        totalPending: 0,
        totalRejected: 0,
        averageConfidence: 0
      };

      let totalConfidence = 0;
      let confidenceCount = 0;
      let lastDetectionDate: string | undefined;
      let lastMergeDate: string | undefined;

      if (statusCounts) {
        for (const record of statusCounts) {
          if (record.verified) {
            stats.totalMerged++;
            if (record.merged_at && (!lastMergeDate || record.merged_at > lastMergeDate)) {
              lastMergeDate = record.merged_at;
            }
          } else {
            stats.totalPending++;
          }

          if (record.confidence_score) {
            totalConfidence += record.confidence_score;
            confidenceCount++;
          }

          if (record.merged_at && (!lastDetectionDate || record.merged_at > lastDetectionDate)) {
            lastDetectionDate = record.merged_at;
          }
        }

        stats.totalDetected = statusCounts.length;
        stats.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
        stats.lastDetectionDate = lastDetectionDate;
        stats.lastMergeDate = lastMergeDate;
      }

      console.log('✅ Statistics calculated:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Error in getChangeStatistics:', error);
      // Return empty statistics instead of throwing
      return {
        totalDetected: 0,
        totalMerged: 0,
        totalPending: 0,
        totalRejected: 0,
        averageConfidence: 0
      };
    }
  }

  /**
   * Verify a username change with additional checks
   */
  async verifyUsernameChange(change: UsernameChangeData): Promise<{ verified: boolean; confidence: number; reasons: string[] }> {
    try {
      console.log(`🔍 Verifying username change: ${change.old_username} → ${change.new_username}`);
      
      const reasons: string[] = [];
      let confidence = change.confidence_score || 0;

      // Check if the old username exists in our data
      const { data: oldUserData } = await supabase
        .from('leaderboard')
        .select('username, user_id, rp')
        .eq('username', change.old_username)
        .limit(1);

      // Check if the new username exists in our data
      const { data: newUserData } = await supabase
        .from('leaderboard')
        .select('username, user_id, rp')
        .eq('username', change.new_username)
        .limit(1);

      // Check if user_id matches
      if (oldUserData && oldUserData.length > 0 && newUserData && newUserData.length > 0) {
        if (oldUserData[0].user_id === newUserData[0].user_id) {
          reasons.push('User ID matches between old and new username');
          confidence += 0.3;
        } else {
          reasons.push('User ID mismatch between old and new username');
          confidence -= 0.5;
        }

        // Check RP similarity
        const rpDifference = Math.abs((oldUserData[0].rp || 0) - (newUserData[0].rp || 0));
        if (rpDifference < 100) {
          reasons.push('RP values are similar');
          confidence += 0.2;
        } else {
          reasons.push('RP values differ significantly');
          confidence -= 0.3;
        }
      } else {
        reasons.push('One or both usernames not found in leaderboard');
        confidence -= 0.4;
      }

      // Check timing evidence
      if (change.notes) {
        reasons.push(`Additional notes: ${change.notes}`);
        confidence += 0.1;
      }

      const verified = confidence >= 0.7;
      
      console.log(`✅ Verification result: ${verified ? 'VERIFIED' : 'REJECTED'} (confidence: ${confidence.toFixed(2)})`);
      
      return {
        verified,
        confidence: Math.max(0, Math.min(1, confidence)),
        reasons
      };
    } catch (error) {
      console.error('❌ Error in verifyUsernameChange:', error);
      throw error;
    }
  }

  /**
   * Reject a username change
   */
  async rejectUsernameChange(
    oldUsername: string, 
    newUsername: string, 
    userId: number,
    reason: string = 'Manually rejected'
  ): Promise<boolean> {
    try {
      console.log(`❌ Rejecting username change: ${oldUsername} → ${newUsername}`);
      
      // Check if username_change_log table exists before trying to update it
      const { data: tableExists, error: tableCheckError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'username_change_log')
        .limit(1);

      if (tableCheckError) {
        console.warn('⚠️ Could not check if username_change_log table exists:', tableCheckError);
      }

      // Only update the log if the table exists
      if (tableExists && tableExists.length > 0) {
        const { error } = await supabase
          .from('username_change_log')
          .update({
            verified: false,
            merged_at: new Date().toISOString(),
            notes: `Rejected: ${reason}`
          })
          .eq('old_username', oldUsername)
          .eq('new_username', newUsername)
          .eq('user_id', userId);

        if (error) {
          console.error('❌ Error rejecting username change:', error);
          throw error;
        }
      } else {
        console.log('ℹ️ username_change_log table does not exist yet, skipping log update');
      }

      console.log(`✅ Successfully rejected username change: ${oldUsername} → ${newUsername}`);
      return true;
    } catch (error) {
      console.error('❌ Error in rejectUsernameChange:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific username change
   */
  async getChangeDetails(oldUsername: string, newUsername: string): Promise<UsernameChangeData | null> {
    try {
      console.log(`📋 Getting details for username change: ${oldUsername} → ${newUsername}`);
      
      // Check if username_change_log table exists before trying to query it
      const { data: tableExists, error: tableCheckError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'username_change_log')
        .limit(1);

      if (tableCheckError) {
        console.warn('⚠️ Could not check if username_change_log table exists:', tableCheckError);
      }

      // If table doesn't exist, return null
      if (!tableExists || tableExists.length === 0) {
        console.log('ℹ️ username_change_log table does not exist yet, returning null');
        return null;
      }
      
      const { data, error } = await supabase
        .from('username_change_log')
        .select('*')
        .eq('old_username', oldUsername)
        .eq('new_username', newUsername)
        .limit(1);

      if (error) {
        console.error('❌ Error fetching change details:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('No change found with specified criteria');
        return null;
      }

      console.log('✅ Change details retrieved');
      return data[0] as UsernameChangeData;
    } catch (error) {
      console.error('❌ Error in getChangeDetails:', error);
      throw error;
    }
  }
}

// Export singleton instance for easy access
export const usernameChangeManager = new UsernameChangeManager(); 