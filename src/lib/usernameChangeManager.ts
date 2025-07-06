import { supabase } from './supabase';
import { leaderboardService } from '../services/leaderboardService';

// TypeScript interfaces for username change management
export interface UsernameChangeData {
  old_username: string;
  new_username: string;
  user_id: number;
  confidence_score: number;
  evidence: {
    rp_difference?: number;
    rank_difference?: number;
    timing?: string;
    last_seen_old?: string;
    first_seen_new?: string;
  };
  status: 'pending' | 'verified' | 'merged' | 'rejected';
  created_at: string;
  merged_at?: string;
  merged_by?: string;
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
  status?: 'pending' | 'verified' | 'merged' | 'rejected';
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
        old_username: change.old_username,
        new_username: change.new_username,
        user_id: change.user_id,
        confidence_score: change.confidence_score || 0,
        evidence: {
          rp_difference: change.rp_difference,
          rank_difference: change.rank_difference,
          timing: change.timing,
          last_seen_old: change.last_seen_old,
          first_seen_new: change.first_seen_new
        },
        status: 'pending',
        created_at: new Date().toISOString()
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
      
      let query = supabase
        .from('username_change_log')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
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
        throw error;
      }

      console.log(`✅ Found ${data?.length || 0} unverified changes`);
      return data || [];
    } catch (error) {
      console.error('❌ Error in getUnverifiedChanges:', error);
      throw error;
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

      // Update the status in username_change_log table
      const { error: updateError } = await supabase
        .from('username_change_log')
        .update({
          status: 'merged',
          merged_at: new Date().toISOString(),
          merged_by: mergedBy
        })
        .eq('old_username', oldUsername)
        .eq('new_username', newUsername)
        .eq('user_id', userId);

      if (updateError) {
        console.error('❌ Error updating change log:', updateError);
        // Don't throw here as the merge was successful
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
      
      // Get total counts by status
      const { data: statusCounts, error: statusError } = await supabase
        .from('username_change_log')
        .select('status, confidence_score, created_at, merged_at')
        .order('created_at', { ascending: false });

      if (statusError) {
        console.error('❌ Error fetching status counts:', statusError);
        throw statusError;
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
          switch (record.status) {
            case 'pending':
              stats.totalPending++;
              break;
            case 'merged':
              stats.totalMerged++;
              if (record.merged_at && (!lastMergeDate || record.merged_at > lastMergeDate)) {
                lastMergeDate = record.merged_at;
              }
              break;
            case 'rejected':
              stats.totalRejected++;
              break;
          }

          if (record.confidence_score) {
            totalConfidence += record.confidence_score;
            confidenceCount++;
          }

          if (record.created_at && (!lastDetectionDate || record.created_at > lastDetectionDate)) {
            lastDetectionDate = record.created_at;
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
      throw error;
    }
  }

  /**
   * Verify a username change with additional checks
   */
  async verifyUsernameChange(change: UsernameChangeData): Promise<{ verified: boolean; confidence: number; reasons: string[] }> {
    try {
      console.log(`🔍 Verifying username change: ${change.old_username} → ${change.new_username}`);
      
      const reasons: string[] = [];
      let confidence = change.confidence_score;

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
      if (change.evidence.timing) {
        reasons.push(`Timing evidence: ${change.evidence.timing}`);
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
      
      const { error } = await supabase
        .from('username_change_log')
        .update({
          status: 'rejected',
          merged_at: new Date().toISOString(),
          merged_by: 'system'
        })
        .eq('old_username', oldUsername)
        .eq('new_username', newUsername)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ Error rejecting username change:', error);
        throw error;
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