/*
  # Update account usernames to match Roblox usernames
  
  1. Changes
    - Remove username column from player_accounts table since it's redundant
    - The username will now be fetched from Roblox API
  
  2. Security
    - Maintain existing RLS policies
    - No security changes needed
*/

-- Remove username column from player_accounts
ALTER TABLE player_accounts 
DROP COLUMN IF EXISTS username;