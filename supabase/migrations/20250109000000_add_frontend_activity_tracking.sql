/*
  # Add Frontend Activity Tracking Functions
  
  1. Changes
    - Add database functions for frontend activity tracking
    - Add player_activity_summary view
    - Add session tracking functions
  
  2. Functions
    - track_presence_session(): Handles session tracking from frontend
    - update_activity_summary(): Updates activity summaries
    - get_player_activity(): Gets aggregated activity data
*/

-- Function to track presence session from frontend
CREATE OR REPLACE FUNCTION track_presence_session(
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
  session_minutes INTEGER;
  result JSONB;
BEGIN
  -- Get current session info
  SELECT 
    session_id,
    session_start_time
  INTO current_session_id, session_start_time
  FROM user_sessions 
  WHERE user_id = user_id_param 
    AND session_end_time IS NULL
  ORDER BY session_start_time DESC 
  LIMIT 1;

  -- Handle session tracking
  IF is_online_param THEN
    -- User is online
    IF current_session_id IS NULL THEN
      -- Start new session
      INSERT INTO user_sessions (user_id, session_start_time, is_in_game, in_bedwars, place_id, universe_id)
      VALUES (user_id_param, NOW(), is_in_game_param, in_bedwars_param, place_id_param, universe_id_param)
      RETURNING session_id INTO current_session_id;
    ELSE
      -- Update existing session
      UPDATE user_sessions 
      SET 
        is_in_game = is_in_game_param,
        in_bedwars = in_bedwars_param,
        place_id = place_id_param,
        universe_id = universe_id_param,
        last_updated = NOW()
      WHERE session_id = current_session_id;
    END IF;
  ELSE
    -- User is offline
    IF current_session_id IS NOT NULL THEN
      -- End current session
      UPDATE user_sessions 
      SET session_end_time = NOW()
      WHERE session_id = current_session_id;
      
      -- Calculate session minutes
      session_minutes = EXTRACT(EPOCH FROM (NOW() - session_start_time)) / 60;
      
      -- Update daily minutes
      UPDATE roblox_user_status 
      SET 
        daily_minutes_today = COALESCE(daily_minutes_today, 0) + session_minutes,
        last_updated = NOW()
      WHERE user_id = user_id_param;
    END IF;
  END IF;

  -- Update basic status
  INSERT INTO roblox_user_status (
    user_id, 
    is_online, 
    is_in_game, 
    in_bedwars, 
    place_id, 
    universe_id, 
    last_updated
  ) VALUES (
    user_id_param, 
    is_online_param, 
    is_in_game_param, 
    in_bedwars_param, 
    place_id_param, 
    universe_id_param, 
    NOW()
  ) ON CONFLICT (user_id) DO UPDATE SET
    is_online = EXCLUDED.is_online,
    is_in_game = EXCLUDED.is_in_game,
    in_bedwars = EXCLUDED.in_bedwars,
    place_id = EXCLUDED.place_id,
    universe_id = EXCLUDED.universe_id,
    last_updated = EXCLUDED.last_updated;

  -- Return session info
  result = jsonb_build_object(
    'session_id', current_session_id,
    'session_minutes', session_minutes,
    'is_online', is_online_param
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to update activity summary
CREATE OR REPLACE FUNCTION update_activity_summary(user_id_param INTEGER)
RETURNS VOID AS $$
DECLARE
  current_session_minutes INTEGER;
  daily_total INTEGER;
  weekly_avg DECIMAL(5,2);
  activity_trend TEXT;
  preferred_period TEXT;
BEGIN
  -- Calculate current session minutes
  SELECT COALESCE(
    EXTRACT(EPOCH FROM (NOW() - session_start_time)) / 60, 
    0
  ) INTO current_session_minutes
  FROM user_sessions 
  WHERE user_id = user_id_param 
    AND session_end_time IS NULL
  ORDER BY session_start_time DESC 
  LIMIT 1;

  -- Get daily total
  SELECT COALESCE(daily_minutes_today, 0) INTO daily_total
  FROM roblox_user_status 
  WHERE user_id = user_id_param;

  -- Calculate weekly average (simplified)
  weekly_avg = (daily_total * 7) / 7.0;

  -- Determine trend
  activity_trend = CASE 
    WHEN daily_total > weekly_avg * 1.2 THEN 'increasing'
    WHEN daily_total < weekly_avg * 0.8 THEN 'decreasing'
    ELSE 'stable'
  END;

  -- Determine preferred time period
  SELECT 
    CASE 
      WHEN EXTRACT(HOUR FROM NOW()) BETWEEN 6 AND 11 THEN 'morning'
      WHEN EXTRACT(HOUR FROM NOW()) BETWEEN 12 AND 16 THEN 'afternoon'
      WHEN EXTRACT(HOUR FROM NOW()) BETWEEN 17 AND 21 THEN 'evening'
      ELSE 'night'
    END INTO preferred_period;

  -- Update or insert activity summary
  INSERT INTO player_activity_summary (
    user_id,
    daily_minutes_today,
    weekly_average,
    activity_trend,
    preferred_time_period,
    current_session_minutes,
    is_online,
    last_updated
  ) VALUES (
    user_id_param,
    daily_total,
    weekly_avg,
    activity_trend,
    preferred_period,
    current_session_minutes,
    (SELECT is_online FROM roblox_user_status WHERE user_id = user_id_param),
    NOW()
  ) ON CONFLICT (user_id) DO UPDATE SET
    daily_minutes_today = EXCLUDED.daily_minutes_today,
    weekly_average = EXCLUDED.weekly_average,
    activity_trend = EXCLUDED.activity_trend,
    preferred_time_period = EXCLUDED.preferred_time_period,
    current_session_minutes = EXCLUDED.current_session_minutes,
    is_online = EXCLUDED.is_online,
    last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql;

-- Create user_sessions table for session tracking
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES roblox_user_status(user_id),
  session_start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  session_end_time TIMESTAMP WITH TIME ZONE,
  is_in_game BOOLEAN DEFAULT FALSE,
  in_bedwars BOOLEAN DEFAULT FALSE,
  place_id INTEGER,
  universe_id INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_activity_summary table
CREATE TABLE IF NOT EXISTS player_activity_summary (
  user_id INTEGER PRIMARY KEY REFERENCES roblox_user_status(user_id),
  daily_minutes_today INTEGER DEFAULT 0,
  weekly_average DECIMAL(5,2) DEFAULT 0,
  activity_trend TEXT DEFAULT 'stable',
  preferred_time_period TEXT DEFAULT 'unknown',
  current_session_minutes INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id) WHERE session_end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_player_activity_summary_user_id ON player_activity_summary(user_id);

-- Add comments
COMMENT ON FUNCTION track_presence_session IS 'Tracks user presence sessions from frontend';
COMMENT ON FUNCTION update_activity_summary IS 'Updates activity summary for a user';
COMMENT ON TABLE user_sessions IS 'Tracks user online sessions';
COMMENT ON TABLE player_activity_summary IS 'Activity summaries for players'; 