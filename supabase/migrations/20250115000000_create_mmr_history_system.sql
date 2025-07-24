-- =====================================================
-- MMR History System Database Migration
-- =====================================================

-- Create mmr_snapshots table
CREATE TABLE IF NOT EXISTS mmr_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    current_rank TEXT NOT NULL,
    current_rp INTEGER NOT NULL,
    estimated_glicko DECIMAL(8,2) NOT NULL,
    estimated_rd DECIMAL(6,4) NOT NULL,
    estimated_volatility DECIMAL(6,4) NOT NULL,
    accuracy_score DECIMAL(5,2) NOT NULL,
    avg_rp_per_win DECIMAL(6,2),
    avg_rp_per_loss DECIMAL(6,2),
    recent_win_rate DECIMAL(5,2),
    total_wins INTEGER NOT NULL,
    shield_games_used INTEGER DEFAULT 0,
    is_new_season BOOLEAN DEFAULT FALSE,
    previous_season_mmr DECIMAL(8,2),
    skill_gap DECIMAL(8,2),
    ranking_status TEXT,
    user_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_matches table for sequential match tracking
CREATE TABLE IF NOT EXISTS user_matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES mmr_snapshots(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
    rp_change INTEGER NOT NULL,
    was_shielded BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_mmr_stats table for user statistics and contribution levels
CREATE TABLE IF NOT EXISTS user_mmr_stats (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    total_snapshots INTEGER DEFAULT 0,
    peak_glicko DECIMAL(8,2),
    glicko_change_30d DECIMAL(8,2),
    data_contribution_level INTEGER DEFAULT 0,
    last_snapshot_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mmr_snapshots_user_id ON mmr_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_mmr_snapshots_created_at ON mmr_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_user_matches_user_id ON user_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_snapshot_id ON user_matches(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_match_number ON user_matches(user_id, match_number);

-- Create function to process match history
CREATE OR REPLACE FUNCTION process_match_history(
    p_user_id UUID,
    p_snapshot_id UUID,
    p_matches JSONB
)
RETURNS VOID AS $$
DECLARE
    match_record JSONB;
    match_count INTEGER := 0;
BEGIN
    -- Clear existing matches for this snapshot
    DELETE FROM user_matches WHERE snapshot_id = p_snapshot_id;
    
    -- Insert new matches
    FOR match_record IN SELECT * FROM jsonb_array_elements(p_matches)
    LOOP
        INSERT INTO user_matches (
            user_id,
            snapshot_id,
            match_number,
            outcome,
            rp_change,
            was_shielded
        ) VALUES (
            p_user_id,
            p_snapshot_id,
            match_count + 1,
            (match_record->>'outcome')::TEXT,
            (match_record->>'rpChange')::INTEGER,
            COALESCE((match_record->>'wasShielded')::BOOLEAN, FALSE)
        );
        
        match_count := match_count + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user match statistics
CREATE OR REPLACE FUNCTION get_user_match_stats(p_user_id UUID)
RETURNS TABLE(
    total_snapshots BIGINT,
    peak_glicko DECIMAL(8,2),
    glicko_change_30d DECIMAL(8,2),
    data_contribution_level INTEGER,
    last_snapshot_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ums.total_snapshots, 0)::BIGINT,
        ums.peak_glicko,
        ums.glicko_change_30d,
        COALESCE(ums.data_contribution_level, 0),
        ums.last_snapshot_at
    FROM user_mmr_stats ums
    WHERE ums.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user stats when snapshot is created
CREATE OR REPLACE FUNCTION update_user_mmr_stats()
RETURNS TRIGGER AS $$
DECLARE
    peak_glicko DECIMAL(8,2);
    glicko_change_30d DECIMAL(8,2);
    contribution_level INTEGER;
BEGIN
    -- Get peak Glicko for this user
    SELECT MAX(estimated_glicko) INTO peak_glicko
    FROM mmr_snapshots
    WHERE user_id = NEW.user_id;
    
    -- Calculate 30-day Glicko change
    SELECT 
        NEW.estimated_glicko - COALESCE(
            (SELECT estimated_glicko 
             FROM mmr_snapshots 
             WHERE user_id = NEW.user_id 
             AND created_at < NEW.created_at - INTERVAL '30 days'
             ORDER BY created_at DESC 
             LIMIT 1), 
            NEW.estimated_glicko
        )
    INTO glicko_change_30d;
    
    -- Calculate contribution level based on snapshots
    SELECT 
        CASE 
            WHEN COUNT(*) >= 50 THEN 3
            WHEN COUNT(*) >= 20 THEN 2
            WHEN COUNT(*) >= 5 THEN 1
            ELSE 0
        END
    INTO contribution_level
    FROM mmr_snapshots
    WHERE user_id = NEW.user_id;
    
    -- Insert or update user stats
    INSERT INTO user_mmr_stats (
        user_id,
        total_snapshots,
        peak_glicko,
        glicko_change_30d,
        data_contribution_level,
        last_snapshot_at,
        updated_at
    ) VALUES (
        NEW.user_id,
        (SELECT COUNT(*) FROM mmr_snapshots WHERE user_id = NEW.user_id),
        peak_glicko,
        glicko_change_30d,
        contribution_level,
        NEW.created_at,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_snapshots = EXCLUDED.total_snapshots,
        peak_glicko = EXCLUDED.peak_glicko,
        glicko_change_30d = EXCLUDED.glicko_change_30d,
        data_contribution_level = EXCLUDED.data_contribution_level,
        last_snapshot_at = EXCLUDED.last_snapshot_at,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update user stats when snapshot is created
CREATE TRIGGER trigger_update_user_mmr_stats
    AFTER INSERT ON mmr_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_user_mmr_stats();

-- Create function to get rank difficulty analysis
CREATE OR REPLACE FUNCTION get_rank_difficulty_analysis()
RETURNS TABLE(
    rank_tier TEXT,
    avg_glicko DECIMAL(8,2),
    avg_rp_gain DECIMAL(6,2),
    avg_rp_loss DECIMAL(6,2),
    sample_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ms.current_rank,
        AVG(ms.estimated_glicko)::DECIMAL(8,2),
        AVG(ms.avg_rp_per_win)::DECIMAL(6,2),
        AVG(ms.avg_rp_per_loss)::DECIMAL(6,2),
        COUNT(*)::INTEGER
    FROM mmr_snapshots ms
    WHERE ms.avg_rp_per_win IS NOT NULL 
    AND ms.avg_rp_per_loss IS NOT NULL
    GROUP BY ms.current_rank
    ORDER BY AVG(ms.estimated_glicko);
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE mmr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mmr_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own snapshots" ON mmr_snapshots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own snapshots" ON mmr_snapshots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own matches" ON user_matches
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own matches" ON user_matches
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own stats" ON user_mmr_stats
    FOR SELECT USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON mmr_snapshots TO authenticated;
GRANT ALL ON user_matches TO authenticated;
GRANT ALL ON user_mmr_stats TO authenticated;
GRANT EXECUTE ON FUNCTION process_match_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_match_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_rank_difficulty_analysis TO authenticated; 