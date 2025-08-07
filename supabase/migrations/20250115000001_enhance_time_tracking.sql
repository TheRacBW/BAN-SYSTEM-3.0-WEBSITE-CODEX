-- Enhanced Time Tracking System
-- This migration improves the time tracking system for better coin rewards and user management

-- Add new columns to user_session_time for better tracking
ALTER TABLE user_session_time ADD COLUMN IF NOT EXISTS total_time_seconds integer DEFAULT 0;
ALTER TABLE user_session_time ADD COLUMN IF NOT EXISTS last_activity timestamp with time zone DEFAULT now();
ALTER TABLE user_session_time ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add new columns to user_coins for better tracking
ALTER TABLE user_coins ADD COLUMN IF NOT EXISTS total_time_spent_seconds integer DEFAULT 0;
ALTER TABLE user_coins ADD COLUMN IF NOT EXISTS coins_from_time integer DEFAULT 0;
ALTER TABLE user_coins ADD COLUMN IF NOT EXISTS last_time_reward timestamp with time zone;

-- Create a function to calculate time-based coin rewards
CREATE OR REPLACE FUNCTION calculate_time_coins(time_seconds integer)
RETURNS integer AS $$
BEGIN
    -- Award 30 coins every 30 minutes (1800 seconds)
    RETURN (time_seconds / 1800) * 30;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update user coins from time spent
CREATE OR REPLACE FUNCTION update_user_coins_from_time(user_uuid uuid)
RETURNS void AS $$
DECLARE
    total_time integer;
    coins_earned integer;
    current_coins integer;
BEGIN
    -- Get total time spent by user
    SELECT COALESCE(SUM(duration_seconds), 0) INTO total_time
    FROM user_session_time
    WHERE user_id = user_uuid AND duration_seconds IS NOT NULL;
    
    -- Calculate coins earned from time
    coins_earned := calculate_time_coins(total_time);
    
    -- Get current coins
    SELECT COALESCE(coins, 0) INTO current_coins
    FROM user_coins
    WHERE user_id = user_uuid;
    
    -- Update user coins if they have a record
    IF current_coins IS NOT NULL THEN
        UPDATE user_coins 
        SET 
            coins = coins + coins_earned,
            total_earned = total_earned + coins_earned,
            total_time_spent_seconds = total_time,
            coins_from_time = coins_from_time + coins_earned,
            last_time_reward = now(),
            last_updated = now()
        WHERE user_id = user_uuid;
    ELSE
        -- Create new user coins record
        INSERT INTO user_coins (user_id, coins, total_earned, total_time_spent_seconds, coins_from_time, last_time_reward)
        VALUES (user_uuid, coins_earned, coins_earned, total_time, coins_earned, now());
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get user time and coin statistics
CREATE OR REPLACE FUNCTION get_user_time_stats(user_uuid uuid)
RETURNS TABLE(
    total_time_seconds integer,
    total_coins integer,
    coins_from_time integer,
    last_activity timestamp with time zone,
    active_sessions integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(uc.total_time_spent_seconds, 0) as total_time_seconds,
        COALESCE(uc.coins, 0) as total_coins,
        COALESCE(uc.coins_from_time, 0) as coins_from_time,
        COALESCE(uc.last_updated, now()) as last_activity,
        COUNT(ust.id)::integer as active_sessions
    FROM user_coins uc
    LEFT JOIN user_session_time ust ON ust.user_id = uc.user_id AND ust.is_active = true
    WHERE uc.user_id = user_uuid
    GROUP BY uc.total_time_spent_seconds, uc.coins, uc.coins_from_time, uc.last_updated;
END;
$$ LANGUAGE plpgsql;

-- Create a function to start a new session
CREATE OR REPLACE FUNCTION start_user_session(user_uuid uuid)
RETURNS uuid AS $$
DECLARE
    session_id uuid;
BEGIN
    -- End any existing active sessions for this user
    UPDATE user_session_time 
    SET 
        session_end = now(),
        duration_seconds = EXTRACT(EPOCH FROM (now() - session_start)),
        is_active = false
    WHERE user_id = user_uuid AND is_active = true;
    
    -- Start new session
    INSERT INTO user_session_time (user_id, session_start, is_active)
    VALUES (user_uuid, now(), true)
    RETURNING id INTO session_id;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql;

-- Create a function to end a session and award coins
CREATE OR REPLACE FUNCTION end_user_session(session_uuid uuid)
RETURNS void AS $$
DECLARE
    user_uuid uuid;
    session_duration integer;
    coins_earned integer;
BEGIN
    -- Get session info
    SELECT user_id, EXTRACT(EPOCH FROM (now() - session_start))::integer
    INTO user_uuid, session_duration
    FROM user_session_time
    WHERE id = session_uuid;
    
    -- Update session
    UPDATE user_session_time 
    SET 
        session_end = now(),
        duration_seconds = session_duration,
        is_active = false,
        coins_earned = calculate_time_coins(session_duration)
    WHERE id = session_uuid;
    
    -- Award coins if any earned
    IF session_duration > 0 THEN
        coins_earned := calculate_time_coins(session_duration);
        IF coins_earned > 0 THEN
            PERFORM update_user_coins_from_time(user_uuid);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_session_time_is_active ON user_session_time(is_active);
CREATE INDEX IF NOT EXISTS idx_user_session_time_last_activity ON user_session_time(last_activity);
CREATE INDEX IF NOT EXISTS idx_user_coins_total_time ON user_coins(total_time_spent_seconds);
CREATE INDEX IF NOT EXISTS idx_user_coins_last_time_reward ON user_coins(last_time_reward);

-- Add comments
COMMENT ON FUNCTION calculate_time_coins IS 'Calculates coin rewards based on time spent (30 coins per 30 minutes)';
COMMENT ON FUNCTION update_user_coins_from_time IS 'Updates user coins based on total time spent';
COMMENT ON FUNCTION get_user_time_stats IS 'Returns comprehensive time and coin statistics for a user';
COMMENT ON FUNCTION start_user_session IS 'Starts a new session for a user, ending any existing active sessions';
COMMENT ON FUNCTION end_user_session IS 'Ends a session and awards coins based on time spent'; 