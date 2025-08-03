-- Admin Report System Database Schema
-- Run this in your Supabase SQL editor

-- 1. Create the main reports table
CREATE TABLE IF NOT EXISTS admin_report_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_username TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'hacking/exploiting',
    'queue_dodging', 
    'glitch_abusing',
    'alt_farming',
    'hate_speech',
    'hate_building'
  )),
  youtube_video_url TEXT NOT NULL,
  match_history_image_url TEXT,
  reported_players JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_suspect_user_id BIGINT,
  video_timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'not_reviewed' CHECK (status IN (
    'not_reviewed',
    'under_review',
    'needs_more_evidence',
    'need_another_ac_mod',
    'solved_banned',
    'solved_not_banned',
    'not_enough_evidence',
    'invalid_report'
  )),
  case_flags TEXT[] DEFAULT '{}',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create user report restrictions table
CREATE TABLE IF NOT EXISTS user_report_restrictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('warning', 'temp_ban', 'permanent_ban')),
  reason TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Create user report statistics table
CREATE TABLE IF NOT EXISTS user_report_stats (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_reports_submitted INTEGER DEFAULT 0,
  false_reports_count INTEGER DEFAULT 0,
  last_report_at TIMESTAMP WITH TIME ZONE,
  false_report_rate DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_report_cases_status ON admin_report_cases(status);
CREATE INDEX IF NOT EXISTS idx_admin_report_cases_submitted_by ON admin_report_cases(submitted_by);
CREATE INDEX IF NOT EXISTS idx_admin_report_cases_created_at ON admin_report_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_report_cases_reason ON admin_report_cases(reason);
CREATE INDEX IF NOT EXISTS idx_user_report_restrictions_user_id ON user_report_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_report_restrictions_expires_at ON user_report_restrictions(expires_at);

-- 5. Create RLS policies for admin_report_cases
ALTER TABLE admin_report_cases ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON admin_report_cases
  FOR SELECT USING (auth.uid() = submitted_by);

-- Users can insert their own reports
CREATE POLICY "Users can insert own reports" ON admin_report_cases
  FOR INSERT WITH CHECK (auth.uid() = submitted_by);

-- Admins and AC mods can view all reports
CREATE POLICY "Admins can view all reports" ON admin_report_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.trust_level >= 2 OR users.is_admin = true)
    )
  );

-- Admins and AC mods can update all reports
CREATE POLICY "Admins can update all reports" ON admin_report_cases
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.trust_level >= 2 OR users.is_admin = true)
    )
  );

-- 6. Create RLS policies for user_report_restrictions
ALTER TABLE user_report_restrictions ENABLE ROW LEVEL SECURITY;

-- Users can view their own restrictions
CREATE POLICY "Users can view own restrictions" ON user_report_restrictions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can manage all restrictions
CREATE POLICY "Admins can manage restrictions" ON user_report_restrictions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.trust_level >= 2 OR users.is_admin = true)
    )
  );

-- 7. Create RLS policies for user_report_stats
ALTER TABLE user_report_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats
CREATE POLICY "Users can view own stats" ON user_report_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all stats
CREATE POLICY "Admins can view all stats" ON user_report_stats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (users.trust_level >= 2 OR users.is_admin = true)
    )
  );

-- 8. Create function to check if user can submit reports
CREATE OR REPLACE FUNCTION can_user_submit_reports(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_active_restriction BOOLEAN;
  restriction_count INTEGER;
BEGIN
  -- Check for active restrictions
  SELECT EXISTS (
    SELECT 1 FROM user_report_restrictions 
    WHERE user_id = user_uuid 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND restriction_type IN ('temp_ban', 'permanent_ban')
  ) INTO has_active_restriction;
  
  IF has_active_restriction THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user has too many false reports (rate limiting)
  SELECT COALESCE(false_reports_count, 0) INTO restriction_count
  FROM user_report_stats 
  WHERE user_id = user_uuid;
  
  -- If user has 3 or more false reports, restrict them
  IF restriction_count >= 3 THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to update user report stats
CREATE OR REPLACE FUNCTION update_user_report_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update user stats when a report is submitted
  INSERT INTO user_report_stats (user_id, total_reports_submitted, last_report_at)
  VALUES (NEW.submitted_by, 1, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_reports_submitted = user_report_stats.total_reports_submitted + 1,
    last_report_at = NOW(),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger to update stats on report submission
CREATE TRIGGER trigger_update_user_report_stats
  AFTER INSERT ON admin_report_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_user_report_stats();

-- 11. Create function to update false report count
CREATE OR REPLACE FUNCTION update_false_report_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When a report is marked as invalid, increment false report count
  IF NEW.status = 'invalid_report' AND OLD.status != 'invalid_report' THEN
    UPDATE user_report_stats 
    SET 
      false_reports_count = false_reports_count + 1,
      false_report_rate = CASE 
        WHEN total_reports_submitted > 0 
        THEN (false_reports_count + 1)::DECIMAL / total_reports_submitted
        ELSE 1.0
      END,
      updated_at = NOW()
    WHERE user_id = NEW.submitted_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Create trigger to update false report count
CREATE TRIGGER trigger_update_false_report_count
  AFTER UPDATE ON admin_report_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_false_report_count();

-- 13. Create function to auto-restrict users with high false report rates
CREATE OR REPLACE FUNCTION auto_restrict_false_reporters()
RETURNS TRIGGER AS $$
DECLARE
  current_false_rate DECIMAL(5,4);
  restriction_exists BOOLEAN;
BEGIN
  -- Get the user's false report rate
  SELECT false_report_rate INTO current_false_rate
  FROM user_report_stats 
  WHERE user_id = NEW.submitted_by;
  
  -- Check if user already has an active restriction
  SELECT EXISTS (
    SELECT 1 FROM user_report_restrictions 
    WHERE user_id = NEW.submitted_by 
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO restriction_exists;
  
  -- Auto-restrict based on false report rate
  IF current_false_rate >= 0.8 AND NOT restriction_exists THEN
    -- 80% or higher false report rate = 7 day ban
    INSERT INTO user_report_restrictions (user_id, restriction_type, reason, expires_at, created_by)
    VALUES (NEW.submitted_by, 'temp_ban', 'High false report rate (auto-generated)', NOW() + INTERVAL '7 days', NEW.reviewed_by);
  ELSIF current_false_rate >= 0.6 AND NOT restriction_exists THEN
    -- 60% or higher false report rate = 3 day ban
    INSERT INTO user_report_restrictions (user_id, restriction_type, reason, expires_at, created_by)
    VALUES (NEW.submitted_by, 'temp_ban', 'High false report rate (auto-generated)', NOW() + INTERVAL '3 days', NEW.reviewed_by);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Create trigger for auto-restriction
CREATE TRIGGER trigger_auto_restrict_false_reporters
  AFTER UPDATE ON admin_report_cases
  FOR EACH ROW
  EXECUTE FUNCTION auto_restrict_false_reporters();

-- 15. Create function to clean up expired restrictions
CREATE OR REPLACE FUNCTION cleanup_expired_restrictions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_report_restrictions 
  WHERE expires_at IS NOT NULL 
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 16. Create a scheduled job to clean up expired restrictions (runs daily)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- SELECT cron.schedule('cleanup-expired-restrictions', '0 0 * * *', 'SELECT cleanup_expired_restrictions();');

-- 17. Create view for admin dashboard statistics
CREATE OR REPLACE VIEW admin_report_dashboard AS
SELECT 
  COUNT(*) as total_reports,
  COUNT(*) FILTER (WHERE status = 'not_reviewed') as unreviewed_reports,
  COUNT(*) FILTER (WHERE status = 'under_review') as under_review_reports,
  COUNT(*) FILTER (WHERE status = 'solved_banned') as solved_banned_reports,
  COUNT(*) FILTER (WHERE status = 'solved_not_banned') as solved_not_banned_reports,
  COUNT(*) FILTER (WHERE status = 'invalid_report') as invalid_reports,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as reports_last_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as reports_last_7d,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) FILTER (WHERE status IN ('solved_banned', 'solved_not_banned', 'invalid_report')) as avg_resolution_hours
FROM admin_report_cases;

-- 18. Grant necessary permissions
GRANT SELECT ON admin_report_dashboard TO authenticated;
GRANT ALL ON admin_report_cases TO authenticated;
GRANT ALL ON user_report_restrictions TO authenticated;
GRANT ALL ON user_report_stats TO authenticated;

-- 19. Create function to get report statistics for a user
CREATE OR REPLACE FUNCTION get_user_report_stats(user_uuid UUID)
RETURNS TABLE(
  total_reports INTEGER,
  false_reports INTEGER,
  false_report_rate DECIMAL(5,4),
  last_report_at TIMESTAMP WITH TIME ZONE,
  is_restricted BOOLEAN,
  restriction_expires TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(urs.total_reports_submitted, 0),
    COALESCE(urs.false_reports_count, 0),
    COALESCE(urs.false_report_rate, 0),
    urs.last_report_at,
    EXISTS (
      SELECT 1 FROM user_report_restrictions 
      WHERE user_id = user_uuid 
      AND (expires_at IS NULL OR expires_at > NOW())
    ),
    (SELECT MAX(expires_at) FROM user_report_restrictions WHERE user_id = user_uuid)
  FROM user_report_stats urs
  WHERE urs.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 20. Create function to add a restriction to a user
CREATE OR REPLACE FUNCTION add_user_restriction(
  target_user_id UUID,
  restriction_type TEXT,
  reason TEXT,
  duration_days INTEGER DEFAULT NULL,
  added_by UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
  restriction_id UUID;
  expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate expiration date
  IF duration_days IS NOT NULL THEN
    expires_at := NOW() + (duration_days || ' days')::INTERVAL;
  END IF;
  
  -- Insert the restriction
  INSERT INTO user_report_restrictions (user_id, restriction_type, reason, expires_at, created_by)
  VALUES (target_user_id, restriction_type, reason, expires_at, added_by)
  RETURNING id INTO restriction_id;
  
  RETURN restriction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. Create function to remove a restriction from a user
CREATE OR REPLACE FUNCTION remove_user_restriction(restriction_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM user_report_restrictions WHERE id = restriction_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 22. Add comments for documentation
COMMENT ON TABLE admin_report_cases IS 'Main table for storing user-submitted anti-cheat reports';
COMMENT ON TABLE user_report_restrictions IS 'Tracks user restrictions for false reporting';
COMMENT ON TABLE user_report_stats IS 'Tracks user report statistics and false report rates';
COMMENT ON FUNCTION can_user_submit_reports(UUID) IS 'Checks if a user is allowed to submit reports';
COMMENT ON FUNCTION update_user_report_stats() IS 'Updates user statistics when a report is submitted';
COMMENT ON FUNCTION update_false_report_count() IS 'Updates false report count when a report is marked invalid';
COMMENT ON FUNCTION auto_restrict_false_reporters() IS 'Automatically restricts users with high false report rates';

-- 23. Create indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_admin_report_cases_reviewed_by ON admin_report_cases(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_admin_report_cases_updated_at ON admin_report_cases(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_report_stats_false_rate ON user_report_stats(false_report_rate);

-- 24. Create a function to get recent reports for a user
CREATE OR REPLACE FUNCTION get_user_recent_reports(user_uuid UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    arc.id,
    arc.reason,
    arc.status,
    arc.created_at,
    arc.reviewed_at
  FROM admin_report_cases arc
  WHERE arc.submitted_by = user_uuid
  ORDER BY arc.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 25. Create a function to get report details with submitter info
CREATE OR REPLACE FUNCTION get_report_with_submitter(report_id UUID)
RETURNS TABLE(
  id UUID,
  submitted_by UUID,
  discord_username TEXT,
  reason TEXT,
  youtube_video_url TEXT,
  match_history_image_url TEXT,
  reported_players JSONB,
  primary_suspect_user_id BIGINT,
  video_timestamps JSONB,
  status TEXT,
  case_flags TEXT[],
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  submitter_username TEXT,
  submitter_discord_verified_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    arc.*,
    u.username as submitter_username,
    u.discord_verified_at as submitter_discord_verified_at
  FROM admin_report_cases arc
  LEFT JOIN users u ON u.id = arc.submitted_by
  WHERE arc.id = report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 