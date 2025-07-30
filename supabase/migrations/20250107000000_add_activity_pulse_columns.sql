/*
  # Add Activity Pulse Columns to roblox_user_status
  
  1. Changes
    - Add activity pulse tracking columns to roblox_user_status table
    - Add timezone and peak hours tracking
    - Add indexes for performance
    - Add proper constraints and defaults
  
  2. Activity Pulse Features
    - Daily minutes tracking (today/yesterday)
    - Weekly averages and trends
    - Timezone detection and peak hours
    - Activity distribution by hour
    - Session tracking for disconnect handling
*/

-- Add activity pulse columns to roblox_user_status
ALTER TABLE roblox_user_status 
ADD COLUMN IF NOT EXISTS daily_minutes_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_minutes_yesterday INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_total_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_average DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activity_trend TEXT DEFAULT 'stable' 
  CHECK (activity_trend IN ('increasing', 'decreasing', 'stable')),
ADD COLUMN IF NOT EXISTS preferred_time_period TEXT DEFAULT 'unknown'
  CHECK (preferred_time_period IN ('morning', 'afternoon', 'evening', 'night', 'unknown')),
ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE;

-- Add timezone and peak hours tracking
ALTER TABLE roblox_user_status 
ADD COLUMN IF NOT EXISTS detected_timezone TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS peak_hours_start INTEGER DEFAULT NULL, -- Hour 0-23
ADD COLUMN IF NOT EXISTS peak_hours_end INTEGER DEFAULT NULL,   -- Hour 0-23
ADD COLUMN IF NOT EXISTS activity_distribution JSONB DEFAULT '{}', -- {"14": 45, "15": 60, "16": 30} minutes per hour
ADD COLUMN IF NOT EXISTS last_disconnect_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS session_start_time TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_roblox_user_status_activity 
ON roblox_user_status(weekly_average DESC, daily_minutes_today DESC);

CREATE INDEX IF NOT EXISTS idx_roblox_user_status_trend 
ON roblox_user_status(activity_trend, weekly_average DESC);

CREATE INDEX IF NOT EXISTS idx_roblox_user_status_timezone 
ON roblox_user_status(detected_timezone, peak_hours_start, peak_hours_end);

-- Add comments for documentation
COMMENT ON COLUMN roblox_user_status.daily_minutes_today IS 'Minutes played today (resets daily)';
COMMENT ON COLUMN roblox_user_status.daily_minutes_yesterday IS 'Minutes played yesterday';
COMMENT ON COLUMN roblox_user_status.weekly_total_minutes IS 'Total minutes played this week';
COMMENT ON COLUMN roblox_user_status.weekly_average IS 'Average minutes per day this week';
COMMENT ON COLUMN roblox_user_status.activity_trend IS 'Activity trend: increasing, decreasing, or stable';
COMMENT ON COLUMN roblox_user_status.preferred_time_period IS 'Most common time period for activity';
COMMENT ON COLUMN roblox_user_status.detected_timezone IS 'Detected timezone based on activity patterns';
COMMENT ON COLUMN roblox_user_status.peak_hours_start IS 'Start hour of peak activity (0-23)';
COMMENT ON COLUMN roblox_user_status.peak_hours_end IS 'End hour of peak activity (0-23)';
COMMENT ON COLUMN roblox_user_status.activity_distribution IS 'JSON object with minutes per hour {"14": 45, "15": 60}';
COMMENT ON COLUMN roblox_user_status.last_disconnect_time IS 'Timestamp of last disconnect for session tracking';
COMMENT ON COLUMN roblox_user_status.session_start_time IS 'Start time of current session'; 