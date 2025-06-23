-- =====================================================
-- 21-Tier Ranking System Database Migration
-- =====================================================

-- Add new columns to leaderboard table
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS calculated_rank_tier TEXT;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS calculated_rank_number INTEGER;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS display_rp INTEGER;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS total_rp INTEGER;

-- Add same fields to leaderboard_history table  
ALTER TABLE leaderboard_history ADD COLUMN IF NOT EXISTS calculated_rank_tier TEXT;
ALTER TABLE leaderboard_history ADD COLUMN IF NOT EXISTS calculated_rank_number INTEGER;
ALTER TABLE leaderboard_history ADD COLUMN IF NOT EXISTS display_rp INTEGER;
ALTER TABLE leaderboard_history ADD COLUMN IF NOT EXISTS total_rp INTEGER;

-- Add rank change tracking to rp_changes table
ALTER TABLE rp_changes ADD COLUMN IF NOT EXISTS previous_calculated_rank TEXT;
ALTER TABLE rp_changes ADD COLUMN IF NOT EXISTS new_calculated_rank TEXT;
ALTER TABLE rp_changes ADD COLUMN IF NOT EXISTS rank_tier_change INTEGER;

-- Create function to calculate rank from total RP
CREATE OR REPLACE FUNCTION calculate_rank_from_rp(total_rp INTEGER)
RETURNS TABLE(rank_tier TEXT, rank_number INTEGER, display_rp INTEGER) AS $$
BEGIN
    -- Handle negative RP
    IF total_rp < 0 THEN
        total_rp := 0;
    END IF;
    
    -- Calculate rank based on RP ranges
    IF total_rp >= 2000 THEN
        -- Nightmare rank (2000+ RP)
        RETURN QUERY SELECT 
            'Nightmare'::TEXT,
            0::INTEGER,
            (total_rp - 2000)::INTEGER;
    ELSIF total_rp >= 1900 THEN
        -- Emerald rank (1900-1999 RP)
        RETURN QUERY SELECT 
            'Emerald'::TEXT,
            0::INTEGER,
            (total_rp - 1900)::INTEGER;
    ELSIF total_rp >= 1600 THEN
        -- Diamond ranks (1600-1899 RP)
        DECLARE
            diamond_tier INTEGER;
        BEGIN
            diamond_tier := (total_rp - 1600) / 100 + 1;
            IF diamond_tier > 3 THEN
                diamond_tier := 3;
            END IF;
            RETURN QUERY SELECT 
                'Diamond'::TEXT,
                diamond_tier::INTEGER,
                (total_rp - (1600 + (diamond_tier - 1) * 100))::INTEGER;
        END;
    ELSIF total_rp >= 1200 THEN
        -- Platinum ranks (1200-1599 RP)
        DECLARE
            platinum_tier INTEGER;
        BEGIN
            platinum_tier := (total_rp - 1200) / 100 + 1;
            IF platinum_tier > 4 THEN
                platinum_tier := 4;
            END IF;
            RETURN QUERY SELECT 
                'Platinum'::TEXT,
                platinum_tier::INTEGER,
                (total_rp - (1200 + (platinum_tier - 1) * 100))::INTEGER;
        END;
    ELSIF total_rp >= 800 THEN
        -- Gold ranks (800-1199 RP)
        DECLARE
            gold_tier INTEGER;
        BEGIN
            gold_tier := (total_rp - 800) / 100 + 1;
            IF gold_tier > 4 THEN
                gold_tier := 4;
            END IF;
            RETURN QUERY SELECT 
                'Gold'::TEXT,
                gold_tier::INTEGER,
                (total_rp - (800 + (gold_tier - 1) * 100))::INTEGER;
        END;
    ELSIF total_rp >= 400 THEN
        -- Silver ranks (400-799 RP)
        DECLARE
            silver_tier INTEGER;
        BEGIN
            silver_tier := (total_rp - 400) / 100 + 1;
            IF silver_tier > 4 THEN
                silver_tier := 4;
            END IF;
            RETURN QUERY SELECT 
                'Silver'::TEXT,
                silver_tier::INTEGER,
                (total_rp - (400 + (silver_tier - 1) * 100))::INTEGER;
        END;
    ELSE
        -- Bronze ranks (0-399 RP)
        DECLARE
            bronze_tier INTEGER;
        BEGIN
            bronze_tier := total_rp / 100 + 1;
            IF bronze_tier > 4 THEN
                bronze_tier := 4;
            END IF;
            RETURN QUERY SELECT 
                'Bronze'::TEXT,
                bronze_tier::INTEGER,
                (total_rp - ((bronze_tier - 1) * 100))::INTEGER;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get rank tier index for comparisons
CREATE OR REPLACE FUNCTION get_rank_tier_index(rank_tier TEXT, rank_number INTEGER)
RETURNS INTEGER AS $$
BEGIN
    CASE rank_tier
        WHEN 'Bronze' THEN
            RETURN rank_number;
        WHEN 'Silver' THEN
            RETURN 4 + rank_number;
        WHEN 'Gold' THEN
            RETURN 8 + rank_number;
        WHEN 'Platinum' THEN
            RETURN 12 + rank_number;
        WHEN 'Diamond' THEN
            RETURN 16 + rank_number;
        WHEN 'Emerald' THEN
            RETURN 19;
        WHEN 'Nightmare' THEN
            RETURN 20;
        ELSE
            RETURN 0;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get rank tier color
CREATE OR REPLACE FUNCTION get_rank_tier_color(rank_tier TEXT)
RETURNS TEXT AS $$
BEGIN
    CASE rank_tier
        WHEN 'Bronze' THEN RETURN '#CD7F32';
        WHEN 'Silver' THEN RETURN '#C0C0C0';
        WHEN 'Gold' THEN RETURN '#FFD700';
        WHEN 'Platinum' THEN RETURN '#E5E4E2';
        WHEN 'Diamond' THEN RETURN '#B9F2FF';
        WHEN 'Emerald' THEN RETURN '#50C878';
        WHEN 'Nightmare' THEN RETURN '#8B0000';
        ELSE RETURN '#808080';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get rank tier emoji
CREATE OR REPLACE FUNCTION get_rank_tier_emoji(rank_tier TEXT, rank_number INTEGER)
RETURNS TEXT AS $$
BEGIN
    CASE rank_tier
        WHEN 'Bronze' THEN
            CASE rank_number
                WHEN 1 THEN RETURN '🥉';
                WHEN 2 THEN RETURN '🥉';
                WHEN 3 THEN RETURN '🥉';
                WHEN 4 THEN RETURN '🥉';
                ELSE RETURN '🥉';
            END CASE;
        WHEN 'Silver' THEN
            CASE rank_number
                WHEN 1 THEN RETURN '🥈';
                WHEN 2 THEN RETURN '🥈';
                WHEN 3 THEN RETURN '🥈';
                WHEN 4 THEN RETURN '🥈';
                ELSE RETURN '🥈';
            END CASE;
        WHEN 'Gold' THEN
            CASE rank_number
                WHEN 1 THEN RETURN '🥇';
                WHEN 2 THEN RETURN '🥇';
                WHEN 3 THEN RETURN '🥇';
                WHEN 4 THEN RETURN '🥇';
                ELSE RETURN '🥇';
            END CASE;
        WHEN 'Platinum' THEN RETURN '💎';
        WHEN 'Diamond' THEN RETURN '💎';
        WHEN 'Emerald' THEN RETURN '💚';
        WHEN 'Nightmare' THEN RETURN '👹';
        ELSE RETURN '🏆';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to update calculated ranks for existing data
CREATE OR REPLACE FUNCTION update_calculated_ranks()
RETURNS VOID AS $$
BEGIN
    -- Update leaderboard table
    UPDATE leaderboard SET 
        total_rp = rp,
        calculated_rank_tier = (calculate_rank_from_rp(rp)).rank_tier,
        calculated_rank_number = (calculate_rank_from_rp(rp)).rank_number,
        display_rp = (calculate_rank_from_rp(rp)).display_rp
    WHERE calculated_rank_tier IS NULL;
    
    -- Update leaderboard_history table
    UPDATE leaderboard_history SET 
        total_rp = rp,
        calculated_rank_tier = (calculate_rank_from_rp(rp)).rank_tier,
        calculated_rank_number = (calculate_rank_from_rp(rp)).rank_number,
        display_rp = (calculate_rank_from_rp(rp)).display_rp
    WHERE calculated_rank_tier IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_calculated_rank ON leaderboard(calculated_rank_tier, calculated_rank_number);
CREATE INDEX IF NOT EXISTS idx_leaderboard_total_rp ON leaderboard(total_rp);
CREATE INDEX IF NOT EXISTS idx_leaderboard_history_calculated_rank ON leaderboard_history(calculated_rank_tier, calculated_rank_number);
CREATE INDEX IF NOT EXISTS idx_rp_changes_rank_changes ON rp_changes(previous_calculated_rank, new_calculated_rank);

-- Run the update function to populate calculated ranks for existing data
SELECT update_calculated_ranks();

-- Create view for easier querying of rank statistics
CREATE OR REPLACE VIEW rank_statistics AS
SELECT 
    calculated_rank_tier,
    calculated_rank_number,
    COUNT(*) as player_count,
    AVG(total_rp) as avg_rp,
    MIN(total_rp) as min_rp,
    MAX(total_rp) as max_rp
FROM leaderboard 
WHERE calculated_rank_tier IS NOT NULL
GROUP BY calculated_rank_tier, calculated_rank_number
ORDER BY get_rank_tier_index(calculated_rank_tier, calculated_rank_number);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION calculate_rank_from_rp(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rank_tier_index(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rank_tier_color(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rank_tier_emoji(TEXT, INTEGER) TO authenticated;
GRANT SELECT ON rank_statistics TO authenticated; 