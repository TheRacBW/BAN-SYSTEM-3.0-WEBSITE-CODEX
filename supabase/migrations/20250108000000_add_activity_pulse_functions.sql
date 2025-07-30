/*
  # Add Activity Pulse Database Functions
  
  1. Changes
    - Add daily reset function for activity data
    - Add data cleanup function for inactive users
    - Add scheduled job setup instructions
  
  2. Functions
    - reset_daily_activity_data(): Handles daily resets of activity metrics
    - cleanup_activity_data(): Cleans up old activity data for inactive users
    - setup_activity_pulse_scheduling(): Sets up scheduled jobs (if pg_cron available)
*/

-- Function to handle daily reset of activity data
CREATE OR REPLACE FUNCTION reset_daily_activity_data()
RETURNS void AS $$
BEGIN
  -- Move today's minutes to yesterday and reset today
  UPDATE roblox_user_status
  SET
    daily_minutes_yesterday = daily_minutes_today,
    daily_minutes_today = 0,
    last_reset_date = CURRENT_DATE
  WHERE last_reset_date < CURRENT_DATE OR last_reset_date IS NULL;
  
  -- Update weekly totals (simplified calculation)
  UPDATE roblox_user_status
  SET
    weekly_total_minutes = COALESCE(daily_minutes_today, 0) + 
                          COALESCE(daily_minutes_yesterday, 0) * 6, -- Rough estimate
    weekly_average = (COALESCE(daily_minutes_today, 0) + 
                     COALESCE(daily_minutes_yesterday, 0) * 6) / 7.0
  WHERE last_reset_date = CURRENT_DATE;
  
  -- Log the reset operation
  INSERT INTO _supabase_migrations.schema_migrations (version, statements, name)
  VALUES (
    '20250108000000_reset_activity_data',
    ARRAY['Daily activity data reset completed at ' || NOW()],
    'Activity Pulse Daily Reset'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old activity data for inactive users
CREATE OR REPLACE FUNCTION cleanup_activity_data()
RETURNS void AS $$
BEGIN
  -- Reset inactive users after 30 days
  UPDATE roblox_user_status
  SET
    daily_minutes_today = 0,
    daily_minutes_yesterday = 0,
    weekly_total_minutes = 0,
    weekly_average = 0,
    activity_trend = 'stable',
    preferred_time_period = 'unknown',
    detected_timezone = 'unknown',
    peak_hours_start = NULL,
    peak_hours_end = NULL,
    activity_distribution = '{}',
    last_disconnect_time = NULL,
    session_start_time = NULL
  WHERE last_updated < NOW() - INTERVAL '30 days'
    AND (daily_minutes_today > 0 OR weekly_average > 0);
    
  -- Log the cleanup operation
  INSERT INTO _supabase_migrations.schema_migrations (version, statements, name)
  VALUES (
    '20250108000000_cleanup_activity_data',
    ARRAY['Activity data cleanup completed at ' || NOW()],
    'Activity Pulse Data Cleanup'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to set up scheduled jobs (if pg_cron extension is available)
CREATE OR REPLACE FUNCTION setup_activity_pulse_scheduling()
RETURNS void AS $$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Schedule daily reset at midnight
    PERFORM cron.schedule(
      'reset-daily-activity',
      '0 0 * * *',
      'SELECT reset_daily_activity_data();'
    );
    
    -- Schedule weekly cleanup on Sundays at 2 AM
    PERFORM cron.schedule(
      'cleanup-activity-data',
      '0 2 * * 0',
      'SELECT cleanup_activity_data();'
    );
    
    RAISE NOTICE 'Activity Pulse scheduling configured successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Manual scheduling required.';
    RAISE NOTICE 'To enable automatic scheduling, install pg_cron extension:';
    RAISE NOTICE 'CREATE EXTENSION IF NOT EXISTS pg_cron;';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION reset_daily_activity_data() IS 
'Resets daily activity metrics and updates weekly calculations. Should be run daily at midnight.';

COMMENT ON FUNCTION cleanup_activity_data() IS 
'Cleans up activity data for users inactive for 30+ days. Should be run weekly.';

COMMENT ON FUNCTION setup_activity_pulse_scheduling() IS 
'Sets up scheduled jobs for activity pulse maintenance. Requires pg_cron extension.';

-- Create a view for monitoring activity pulse health
CREATE OR REPLACE VIEW activity_pulse_health AS
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN daily_minutes_today > 0 THEN 1 END) as active_today,
  COUNT(CASE WHEN weekly_average > 0 THEN 1 END) as active_this_week,
  COUNT(CASE WHEN last_reset_date = CURRENT_DATE THEN 1 END) as reset_today,
  COUNT(CASE WHEN last_updated < NOW() - INTERVAL '7 days' THEN 1 END) as inactive_week,
  COUNT(CASE WHEN last_updated < NOW() - INTERVAL '30 days' THEN 1 END) as inactive_month,
  AVG(daily_minutes_today) as avg_daily_minutes,
  AVG(weekly_average) as avg_weekly_minutes
FROM roblox_user_status;

COMMENT ON VIEW activity_pulse_health IS 
'View for monitoring Activity Pulse system health and usage statistics.'; 