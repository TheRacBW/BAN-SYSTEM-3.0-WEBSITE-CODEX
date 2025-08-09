-- Fix Activity Tracking - Add Realistic Caps and Improve Logic
-- This migration improves the activity tracking system to prevent unrealistic time calculations

-- Update the smart_track_presence_session function to add caps and better logic
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
  meaningful_activity BOOLEAN;
  current_daily_minutes INTEGER;
BEGIN
  -- Only count meaningful activity (in_bedwars or is_in_game, not just online)
  meaningful_activity := in_bedwars_param OR is_in_game_param;
  
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
      
      -- Calculate session duration with caps
      session_minutes := GREATEST(0, LEAST(60, EXTRACT(EPOCH FROM (NOW() - last_status_record.detected_at)) / 60));
      
      -- Log session end
      INSERT INTO roblox_presence_logs (
        roblox_user_id, session_id, was_online, was_in_game, in_bedwars,
        place_id, universe_id, status_change_type, session_duration_minutes
      ) VALUES (
        user_id_param, current_session_id, FALSE, FALSE, FALSE,
        place_id_param, universe_id_param, 'session_end', session_minutes
      );
      
      -- Only update daily minutes if there was meaningful activity
      IF (last_status_record.was_in_game OR last_status_record.in_bedwars) THEN
        -- Get current daily minutes and apply cap
        SELECT COALESCE(daily_minutes_today, 0) INTO current_daily_minutes
        FROM roblox_user_status 
        WHERE user_id = user_id_param;
        
        -- Add session minutes but cap at 720 minutes (12 hours) per day
        current_daily_minutes := LEAST(720, current_daily_minutes + session_minutes);
        
        UPDATE roblox_user_status 
        SET daily_minutes_today = current_daily_minutes
        WHERE user_id = user_id_param;
      END IF;
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
    'is_online', is_online_param,
    'meaningful_activity', meaningful_activity
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add function to fix existing unrealistic data
CREATE OR REPLACE FUNCTION fix_unrealistic_activity_data()
RETURNS TABLE(
  user_id INTEGER,
  old_daily_minutes INTEGER,
  new_daily_minutes INTEGER,
  old_weekly_average DECIMAL,
  new_weekly_average DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  UPDATE roblox_user_status 
  SET 
    daily_minutes_today = LEAST(720, GREATEST(0, daily_minutes_today)),
    daily_minutes_yesterday = LEAST(720, GREATEST(0, daily_minutes_yesterday)),
    weekly_average = LEAST(300, GREATEST(0, weekly_average))
  WHERE daily_minutes_today > 720 OR daily_minutes_yesterday > 720 OR weekly_average > 300
  RETURNING 
    roblox_user_status.user_id,
    daily_minutes_today AS old_daily_minutes,
    LEAST(720, GREATEST(0, daily_minutes_today)) AS new_daily_minutes,
    weekly_average AS old_weekly_average,
    LEAST(300, GREATEST(0, weekly_average)) AS new_weekly_average;
END;
$$ LANGUAGE plpgsql;

-- Create function to get realistic activity statistics
CREATE OR REPLACE FUNCTION get_realistic_activity_stats()
RETURNS JSONB AS $$
DECLARE
  stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'users_with_activity_today', COUNT(CASE WHEN daily_minutes_today > 0 THEN 1 END),
    'users_with_unrealistic_daily', COUNT(CASE WHEN daily_minutes_today > 720 THEN 1 END),
    'users_with_unrealistic_weekly', COUNT(CASE WHEN weekly_average > 300 THEN 1 END),
    'avg_daily_minutes', ROUND(AVG(NULLIF(daily_minutes_today, 0)), 2),
    'avg_weekly_average', ROUND(AVG(NULLIF(weekly_average, 0)), 2),
    'max_daily_minutes', MAX(daily_minutes_today),
    'max_weekly_average', MAX(weekly_average),
    'users_very_active_today', COUNT(CASE WHEN daily_minutes_today >= 300 THEN 1 END),
    'users_moderately_active_today', COUNT(CASE WHEN daily_minutes_today >= 60 AND daily_minutes_today < 300 THEN 1 END),
    'users_lightly_active_today', COUNT(CASE WHEN daily_minutes_today > 0 AND daily_minutes_today < 60 THEN 1 END)
  ) INTO stats
  FROM roblox_user_status
  WHERE last_updated > NOW() - INTERVAL '7 days'; -- Only active users in last week
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION smart_track_presence_session IS 'Improved presence tracking with realistic caps and meaningful activity focus';
COMMENT ON FUNCTION fix_unrealistic_activity_data IS 'Fixes existing unrealistic activity data by applying caps';
COMMENT ON FUNCTION get_realistic_activity_stats IS 'Gets statistics about activity data with realistic bounds';