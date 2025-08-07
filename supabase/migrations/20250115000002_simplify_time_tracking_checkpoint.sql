-- Simplify time tracking to use checkpoint system
-- This replaces the complex session-based system with a simple presence-based system

-- Drop the old user_session_time table and related functions
DROP TABLE IF EXISTS user_session_time CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS calculate_time_coins(integer);
DROP FUNCTION IF EXISTS update_user_coins_from_time(uuid);
DROP FUNCTION IF EXISTS get_user_time_stats(uuid);
DROP FUNCTION IF EXISTS start_user_session(uuid);
DROP FUNCTION IF EXISTS end_user_session(uuid);

-- Remove old columns from user_coins table
ALTER TABLE user_coins DROP COLUMN IF EXISTS total_time_spent_seconds;
ALTER TABLE user_coins DROP COLUMN IF EXISTS coins_from_time;
ALTER TABLE user_coins DROP COLUMN IF EXISTS last_time_reward;

-- Add new columns for checkpoint system
ALTER TABLE user_coins ADD COLUMN IF NOT EXISTS last_activity timestamp with time zone DEFAULT now();
ALTER TABLE user_coins ADD COLUMN IF NOT EXISTS last_coin_award_time timestamp with time zone;
ALTER TABLE user_coins ADD COLUMN IF NOT EXISTS total_time_spent_seconds integer DEFAULT 0;

-- Create function to update user presence and award coins
CREATE OR REPLACE FUNCTION update_user_presence_and_award_coins(user_uuid uuid)
RETURNS TABLE(
  coins_awarded integer,
  total_coins integer,
  total_time_seconds integer,
  last_activity timestamp with time zone
) AS $$
DECLARE
  current_time timestamp with time zone := now();
  time_since_last_award interval;
  coins_to_award integer := 0;
  current_coins integer;
  current_time_spent integer;
BEGIN
  -- Get current user coin data
  SELECT coins, total_time_spent_seconds, last_coin_award_time
  INTO current_coins, current_time_spent, time_since_last_award
  FROM user_coins
  WHERE user_id = user_uuid;
  
  -- If no record exists, create one
  IF current_coins IS NULL THEN
    INSERT INTO user_coins (user_id, coins, last_activity, last_coin_award_time, total_time_spent_seconds)
    VALUES (user_uuid, 0, current_time, current_time, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    current_coins := 0;
    current_time_spent := 0;
    time_since_last_award := interval '0';
  END IF;
  
  -- Calculate time since last award
  time_since_last_award := current_time - COALESCE(last_coin_award_time, current_time - interval '5 minutes');
  
  -- Award 5 coins every 5 minutes (300 seconds)
  IF EXTRACT(epoch FROM time_since_last_award) >= 300 THEN
    coins_to_award := 5;
    
    -- Update user coins and activity
    UPDATE user_coins
    SET 
      coins = coins + coins_to_award,
      last_activity = current_time,
      last_coin_award_time = current_time,
      total_time_spent_seconds = total_time_spent_seconds + 300
    WHERE user_id = user_uuid;
    
    current_coins := current_coins + coins_to_award;
    current_time_spent := current_time_spent + 300;
  ELSE
    -- Just update last activity
    UPDATE user_coins
    SET last_activity = current_time
    WHERE user_id = user_uuid;
  END IF;
  
  -- Return results
  RETURN QUERY
  SELECT 
    coins_to_award,
    current_coins,
    current_time_spent,
    current_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user time and coin statistics
CREATE OR REPLACE FUNCTION get_user_time_and_coin_stats(user_uuid uuid)
RETURNS TABLE(
  total_time_seconds integer,
  total_coins integer,
  coins_from_time integer,
  last_activity timestamp with time zone,
  last_coin_award_time timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(uc.total_time_spent_seconds, 0) as total_time_seconds,
    COALESCE(uc.coins, 0) as total_coins,
    COALESCE(uc.coins, 0) as coins_from_time, -- All coins are from time in this system
    uc.last_activity,
    uc.last_coin_award_time
  FROM user_coins uc
  WHERE uc.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all users' time and coin statistics (for admin)
CREATE OR REPLACE FUNCTION get_all_users_time_and_coin_stats()
RETURNS TABLE(
  user_id uuid,
  email text,
  username text,
  total_time_seconds integer,
  total_coins integer,
  coins_from_time integer,
  last_activity timestamp with time zone,
  last_coin_award_time timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uc.user_id,
    u.email,
    u.username,
    COALESCE(uc.total_time_spent_seconds, 0) as total_time_seconds,
    COALESCE(uc.coins, 0) as total_coins,
    COALESCE(uc.coins, 0) as coins_from_time,
    uc.last_activity,
    uc.last_coin_award_time
  FROM user_coins uc
  JOIN auth.users u ON u.id = uc.user_id
  ORDER BY uc.total_time_spent_seconds DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_user_presence_and_award_coins(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_time_and_coin_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_time_and_coin_stats() TO authenticated;

-- Create RLS policies for user_coins table
DROP POLICY IF EXISTS "Users can view their own coin data" ON user_coins;
DROP POLICY IF EXISTS "Admins can view all coin data" ON user_coins;
DROP POLICY IF EXISTS "Users can update their own coin data" ON user_coins;

CREATE POLICY "Users can view their own coin data" ON user_coins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all coin data" ON user_coins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Users can update their own coin data" ON user_coins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own coin data" ON user_coins
  FOR INSERT WITH CHECK (auth.uid() = user_id); 