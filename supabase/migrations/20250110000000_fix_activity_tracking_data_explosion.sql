/*
  # Fix Activity Tracking Data Explosion
  
  Problem: 1,400 records in 10 minutes = 140 records/minute
  Solution: Smart rate limiting, change-only logging, aggressive cleanup
  
  Changes:
  1. Replace track_presence_session with smart version
  2. Add cleanup functions for excessive logs
  3. Add consolidation functions for duplicates
  4. Add comprehensive cleanup function
*/

-- Create roblox_presence_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS roblox_presence_logs (
  id SERIAL PRIMARY KEY,
  roblox_user_id INTEGER NOT NULL REFERENCES roblox_user_status(user_id),
  session_id UUID,
  was_online BOOLEAN NOT NULL,
  was_in_game BOOLEAN DEFAULT FALSE,
  in_bedwars BOOLEAN DEFAULT FALSE,
  place_id INTEGER,
  universe_id INTEGER,
  status_change_type TEXT CHECK (status_change_type IN ('session_start', 'session_end', 'status_change', 'status_check')),
  session_duration_minutes INTEGER,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_presence_logs_user_time ON roblox_presence_logs(roblox_user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_presence_logs_session ON roblox_presence_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_presence_logs_type ON roblox_presence_logs(status_change_type);
CREATE INDEX IF NOT EXISTS idx_presence_logs_cleanup ON roblox_presence_logs(detected_at) WHERE detected_at < NOW() - INTERVAL '7 days';

-- Create smart presence tracking function with unique name
CREATE OR REPLACE FUNCTION smart_track_presence_session(
  user_id_param INTEGER,
  is_online_param BOOLEAN,
  is_in_game_param BOOLEAN,
  in_bedwars_param BOOLEAN,
  place_id_param INTEGER DEFAULT NULL,
  universe_id_param INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  current_session_id UUID;
  session_start_time TIMESTAMP WITH TIME ZONE;
  session_minutes INTEGER := 0;
  last_status_record RECORD;
  should_log BOOLEAN := FALSE;
  time_since_last_log INTEGER;
  result JSONB;
BEGIN
  -- Get the most recent status record
  SELECT 
    was_online, was_in_game, in_bedwars, detected_at,
    session_id
  INTO last_status_record
  FROM roblox_presence_logs 
  WHERE roblox_user_id = user_id_param 
  ORDER BY detected_at DESC 
  LIMIT 1;

  -- Check if we should log this status
  IF last_status_record IS NULL THEN
    -- First time tracking this user
    should_log := TRUE;
  ELSE
    -- Calculate time since last log
    time_since_last_log := EXTRACT(EPOCH FROM (NOW() - last_status_record.detected_at)) / 60;
    
    -- Only log if:
    -- 1. Status actually changed, OR
    -- 2. More than 10 minutes since last log (heartbeat)
    IF (last_status_record.was_online != is_online_param OR
        last_status_record.was_in_game != is_in_game_param OR
        last_status_record.in_bedwars != in_bedwars_param OR
        time_since_last_log > 10) THEN
      should_log := TRUE;
    END IF;
  END IF;

  -- Only proceed if we should log
  IF NOT should_log THEN
    -- Return early without logging
    RETURN jsonb_build_object(
      'logged', false,
      'reason', 'no_change_or_too_recent',
      'time_since_last', time_since_last_log
    );
  END IF;

  -- Handle session tracking (only for meaningful changes)
  IF is_online_param THEN
    -- User is online
    IF last_status_record IS NULL OR NOT last_status_record.was_online THEN
      -- Starting new session
      current_session_id := gen_random_uuid();
      session_start_time := NOW();
      
      -- Log session start
      INSERT INTO roblox_presence_logs (
        roblox_user_id, session_id, was_online, was_in_game, in_bedwars,
        place_id, universe_id, status_change_type
      ) VALUES (
        user_id_param, current_session_id, is_online_param, is_in_game_param, in_bedwars_param,
        place_id_param, universe_id_param, 'session_start'
      );
    ELSE
      -- Continue existing session, only log if status changed
      current_session_id := last_status_record.session_id;
      IF (last_status_record.was_in_game != is_in_game_param OR
          last_status_record.in_bedwars != in_bedwars_param) THEN
        INSERT INTO roblox_presence_logs (
          roblox_user_id, session_id, was_online, was_in_game, in_bedwars,
          place_id, universe_id, status_change_type
        ) VALUES (
          user_id_param, current_session_id, is_online_param, is_in_game_param, in_bedwars_param,
          place_id_param, universe_id_param, 'status_change'
        );
      END IF;
    END IF;
  ELSE
    -- User is offline
    IF last_status_record IS NOT NULL AND last_status_record.was_online THEN
      -- End session
      current_session_id := last_status_record.session_id;
      
      -- Calculate session duration
      session_minutes := EXTRACT(EPOCH FROM (NOW() - last_status_record.detected_at)) / 60;
      
      -- Log session end
      INSERT INTO roblox_presence_logs (
        roblox_user_id, session_id, was_online, was_in_game, in_bedwars,
        place_id, universe_id, status_change_type, session_duration_minutes
      ) VALUES (
        user_id_param, current_session_id, FALSE, FALSE, FALSE,
        place_id_param, universe_id_param, 'session_end', session_minutes
      );
      
      -- Update daily minutes in user status
      UPDATE roblox_user_status 
      SET daily_minutes_today = COALESCE(daily_minutes_today, 0) + session_minutes
      WHERE user_id = user_id_param;
    END IF;
  END IF;

  -- Update basic status (always do this)
  INSERT INTO roblox_user_status (
    user_id, is_online, is_in_game, in_bedwars, 
    place_id, universe_id, last_updated
  ) VALUES (
    user_id_param, is_online_param, is_in_game_param, in_bedwars_param,
    place_id_param, universe_id_param, NOW()
  ) ON CONFLICT (user_id) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    is_in_game = EXCLUDED.is_in_game,
    in_bedwars = EXCLUDED.in_bedwars,
    place_id = EXCLUDED.place_id,
    universe_id = EXCLUDED.universe_id,
    last_updated = EXCLUDED.last_updated;

  -- Return result
  result := jsonb_build_object(
    'logged', true,
    'session_id', current_session_id,
    'session_minutes', session_minutes,
    'is_online', is_online_param
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up excessive presence logs
CREATE OR REPLACE FUNCTION cleanup_excessive_presence_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete redundant status_check logs (keep only meaningful changes)
  DELETE FROM roblox_presence_logs 
  WHERE id IN (
    SELECT id 
    FROM (
      SELECT id,
             LAG(was_online) OVER (PARTITION BY roblox_user_id ORDER BY detected_at) as prev_online,
             LAG(was_in_game) OVER (PARTITION BY roblox_user_id ORDER BY detected_at) as prev_ingame,
             LAG(in_bedwars) OVER (PARTITION BY roblox_user_id ORDER BY detected_at) as prev_bedwars,
             was_online, was_in_game, in_bedwars,
             status_change_type
      FROM roblox_presence_logs
      WHERE detected_at > NOW() - INTERVAL '24 hours'
    ) t
    WHERE status_change_type IS NULL 
      AND prev_online = was_online 
      AND prev_ingame = was_in_game 
      AND prev_bedwars = in_bedwars
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete logs older than 7 days (except session_start and session_end)
  DELETE FROM roblox_presence_logs 
  WHERE detected_at < NOW() - INTERVAL '7 days'
    AND (status_change_type IS NULL OR status_change_type = 'status_check');
  
  -- Delete logs older than 30 days (all types)
  DELETE FROM roblox_presence_logs 
  WHERE detected_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to consolidate duplicate logs
CREATE OR REPLACE FUNCTION consolidate_duplicate_logs()
RETURNS INTEGER AS $$
DECLARE
  consolidated_count INTEGER;
BEGIN
  -- Remove duplicate logs within 1-minute windows
  DELETE FROM roblox_presence_logs 
  WHERE id IN (
    SELECT id 
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY roblox_user_id, 
               DATE_TRUNC('minute', detected_at),
               was_online, was_in_game, in_bedwars
               ORDER BY detected_at DESC
             ) as rn
      FROM roblox_presence_logs
      WHERE detected_at > NOW() - INTERVAL '24 hours'
    ) t
    WHERE rn > 1
  );
  
  GET DIAGNOSTICS consolidated_count = ROW_COUNT;
  RETURN consolidated_count;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive cleanup function
CREATE OR REPLACE FUNCTION comprehensive_presence_cleanup()
RETURNS JSONB AS $$
DECLARE
  redundant_deleted INTEGER;
  duplicates_deleted INTEGER;
  old_deleted INTEGER;
  result JSONB;
BEGIN
  -- Clean up redundant logs
  redundant_deleted := cleanup_excessive_presence_logs();
  
  -- Consolidate duplicates
  duplicates_deleted := consolidate_duplicate_logs();
  
  -- Delete very old logs
  DELETE FROM roblox_presence_logs 
  WHERE detected_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS old_deleted = ROW_COUNT;
  
  -- Return summary
  result := jsonb_build_object(
    'redundant_deleted', redundant_deleted,
    'duplicates_deleted', duplicates_deleted,
    'old_deleted', old_deleted,
    'cleanup_time', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get presence log statistics
CREATE OR REPLACE FUNCTION get_presence_log_stats()
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_logs', COUNT(*),
    'last_hour_logs', COUNT(CASE WHEN detected_at > NOW() - INTERVAL '1 hour' THEN 1 END),
    'last_24h_logs', COUNT(CASE WHEN detected_at > NOW() - INTERVAL '24 hours' THEN 1 END),
    'redundant_logs', COUNT(CASE WHEN status_change_type IS NULL THEN 1 END),
    'session_starts', COUNT(CASE WHEN status_change_type = 'session_start' THEN 1 END),
    'session_ends', COUNT(CASE WHEN status_change_type = 'session_end' THEN 1 END),
    'status_changes', COUNT(CASE WHEN status_change_type = 'status_change' THEN 1 END),
    'unique_users', COUNT(DISTINCT roblox_user_id),
    'avg_logs_per_user', ROUND(COUNT(*)::DECIMAL / NULLIF(COUNT(DISTINCT roblox_user_id), 0), 2)
  ) INTO stats
  FROM roblox_presence_logs;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE roblox_presence_logs IS 'Detailed presence tracking logs with rate limiting';
COMMENT ON FUNCTION smart_track_presence_session IS 'Smart presence tracking with rate limiting and change detection';
COMMENT ON FUNCTION cleanup_excessive_presence_logs IS 'Removes redundant and old presence logs';
COMMENT ON FUNCTION consolidate_duplicate_logs IS 'Removes duplicate logs within time windows';
COMMENT ON FUNCTION comprehensive_presence_cleanup IS 'Comprehensive cleanup of presence logs';
COMMENT ON FUNCTION get_presence_log_stats IS 'Get statistics about presence log usage';