/*
  # Add Roblox user_id column to player_accounts table

  1. Changes
    - Add `user_id` column to `player_accounts` table to store Roblox user IDs
    - Make the column numeric to match Roblox ID format
    - Add index on user_id for better query performance

  2. Notes
    - The column is NOT nullable since we always want a valid Roblox user ID
    - Added an index to optimize queries that filter or join on user_id
*/

-- Add user_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_accounts' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE player_accounts 
    ADD COLUMN user_id numeric NOT NULL;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_player_accounts_user_id 
ON player_accounts(user_id);