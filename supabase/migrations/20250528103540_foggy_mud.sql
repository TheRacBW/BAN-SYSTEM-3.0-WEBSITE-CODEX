-- Remove username column from player_accounts
ALTER TABLE player_accounts 
DROP COLUMN IF EXISTS username;