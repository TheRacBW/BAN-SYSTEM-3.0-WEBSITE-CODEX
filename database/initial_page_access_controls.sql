-- Initial Page Access Controls Migration
-- This sets up the basic page access controls for the verification system

-- Insert initial page access controls
INSERT INTO page_access_controls (page_path, page_name, description, min_trust_level, requires_discord_verification, requires_paid_verification, is_active) VALUES
  ('/', 'Home Page', 'Main landing page - accessible to all users', 0, false, false, true),
  ('/leaderboard', 'Leaderboard', 'Public leaderboard - accessible to all users', 0, false, false, true),
  ('/contact', 'Contact Page', 'Contact form - accessible to all users', 0, false, false, true),
  ('/auth', 'Authentication', 'Login/register pages - accessible to all users', 0, false, false, true),
  ('/settings', 'User Settings', 'User profile and settings - accessible to all users', 0, false, false, true),
  ('/strategies', 'Strategies', 'Strategy creation and browsing - requires Discord verification', 0.5, true, false, true),
  ('/strat-picker', 'Strategy Picker', 'Strategy selection and management - requires Discord verification', 0.5, true, false, true),
  ('/tracker', 'Player Tracker', 'Player tracking and monitoring - requires paid tracker verification', 1, false, true, true),
  ('/players', 'Players Page', 'Player management and tracking - requires paid tracker verification', 1, false, true, true),
  ('/admin', 'Admin Panel', 'Administrative tools - requires trusted status', 2, false, false, true),
  ('/admin/migration', 'Migration Dashboard', 'Database migration tools - requires trusted status', 2, false, false, true),
  ('/verification-demo', 'Verification Demo', 'Demo page for testing verification system', 0, false, false, true);

-- Add comments to explain the trust level system
COMMENT ON TABLE page_access_controls IS 'Controls access to pages based on user trust levels and verification status';
COMMENT ON COLUMN page_access_controls.min_trust_level IS 'Minimum trust level required (0=New, 0.5=Discord Verified, 1=Paid Tracker, 2=Trusted, 3=Moderator)';
COMMENT ON COLUMN page_access_controls.requires_discord_verification IS 'Whether Discord verification is required in addition to trust level';
COMMENT ON COLUMN page_access_controls.requires_paid_verification IS 'Whether paid tracker verification is required in addition to trust level';