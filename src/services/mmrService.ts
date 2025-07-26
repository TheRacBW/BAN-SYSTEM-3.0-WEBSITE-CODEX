import { supabase } from '../lib/supabase';

export interface MMRSnapshot {
  id: string;
  user_id: string;
  current_rank: string;
  current_rp: number;
  estimated_glicko: number;
  estimated_rd: number;
  estimated_volatility: number;
  accuracy_score: number;
  avg_rp_per_win?: number;
  avg_rp_per_loss?: number;
  recent_win_rate?: number;
  total_wins: number;
  shield_games_used: number;
  is_new_season: boolean;
  previous_season_mmr?: number;
  skill_gap?: number;
  ranking_status?: string;
  user_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface UserMatch {
  user_id: string;
  match_number: number;
  recorded_in_snapshot: string;
  outcome: 'win' | 'loss' | 'draw';
  rp_change: number;
  was_shielded: boolean;
  created_at: string;
}

export interface UserMMRStats {
  total_snapshots: number;
  peak_glicko?: number;
  glicko_change_30d?: number;
  data_contribution_level: number;
  last_snapshot_at?: string;
}

export interface RankDifficultyAnalysis {
  rank_tier: string;
  avg_glicko: number;
  avg_rp_gain: number;
  avg_rp_loss: number;
  sample_size: number;
}

// Get user's MMR history
export const getUserMMRHistory = async (userId: string, limit = 20): Promise<MMRSnapshot[]> => {
  const { data, error } = await supabase
    .from('mmr_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  console.log('📊 Raw data from database:', data?.length, 'snapshots');
  return data || [];
};

// Get user match statistics
export const getUserMatchStats = async (userId: string): Promise<UserMMRStats | null> => {
  const { data, error } = await supabase
    .rpc('get_user_match_stats', { p_user_id: userId });
  
  if (error) throw error;
  return data?.[0] || null;
};

// Get user matches for a specific snapshot
export const getUserMatches = async (userId: string, snapshotId: string): Promise<UserMatch[]> => {
  const { data, error } = await supabase
    .from('user_matches')
    .select('*')
    .eq('user_id', userId)
    .eq('recorded_in_snapshot', snapshotId)
    .order('match_number', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

// Save MMR snapshot
export const saveMMRSnapshot = async (snapshot: Omit<MMRSnapshot, 'id' | 'created_at' | 'updated_at'>): Promise<MMRSnapshot> => {
  const { data, error } = await supabase
    .from('mmr_snapshots')
    .insert(snapshot)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Process match history for a snapshot
export const processMatchHistory = async (
  userId: string, 
  snapshotId: string, 
  matches: Array<{ outcome: string; rpChange: number; wasShielded?: boolean }>
): Promise<void> => {
  const { error } = await supabase
    .rpc('process_match_history', {
      p_user_id: userId,
      p_snapshot_id: snapshotId,
      p_matches: matches
    });
  
  if (error) throw error;
};

// Delete MMR snapshot and associated matches
export const deleteMMRSnapshot = async (snapshotId: string): Promise<void> => {
  console.log('🗑️ Starting deletion of snapshot:', snapshotId);
  
  // Delete associated matches first (due to foreign key constraint)
  const { error: matchesError } = await supabase
    .from('user_matches')
    .delete()
    .eq('recorded_in_snapshot', snapshotId);
  
  if (matchesError) {
    console.error('❌ Error deleting matches:', matchesError);
    throw matchesError;
  }
  
  console.log('✅ Matches deleted successfully');
  
  // Delete the snapshot
  const { error: snapshotError } = await supabase
    .from('mmr_snapshots')
    .delete()
    .eq('id', snapshotId);
  
  if (snapshotError) {
    console.error('❌ Error deleting snapshot:', snapshotError);
    throw snapshotError;
  }
  
  console.log('✅ Snapshot deleted successfully');
};

// Get rank difficulty analysis
export const getRankDifficultyAnalysis = async (): Promise<RankDifficultyAnalysis[]> => {
  const { data, error } = await supabase
    .rpc('get_rank_difficulty_analysis');
  
  if (error) throw error;
  return data || [];
};

// Export user data
export const exportUserData = async (userId: string, format: 'csv' | 'json' = 'json'): Promise<string> => {
  // Get all snapshots
  const snapshots = await getUserMMRHistory(userId, 1000);
  
  // Get all matches
  const allMatches: UserMatch[] = [];
  for (const snapshot of snapshots) {
    const matches = await getUserMatches(userId, snapshot.id);
    allMatches.push(...matches);
  }
  
  // Get user stats
  const stats = await getUserMatchStats(userId);
  
  const exportData = {
    user_id: userId,
    export_date: new Date().toISOString(),
    snapshots,
    matches: allMatches,
    stats
  };
  
  if (format === 'csv') {
    // Convert to CSV format
    const csvSnapshots = snapshots.map(s => 
      `${s.created_at},${s.current_rank},${s.current_rp},${s.estimated_glicko},${s.accuracy_score}`
    ).join('\n');
    
    return `Date,Rank,RP,MMR,Accuracy\n${csvSnapshots}`;
  }
  
  return JSON.stringify(exportData, null, 2);
}; 