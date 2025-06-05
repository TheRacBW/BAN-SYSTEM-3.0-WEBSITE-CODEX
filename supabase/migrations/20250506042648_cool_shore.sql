/*
  # Update Player Accounts System
  
  1. Changes
    - Add user_id column to player_accounts table
    - Add index for user_id column
    - Update RLS policies
  
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Add user_id column if it doesn't exist
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

-- Update RLS policies
DROP POLICY IF EXISTS "Users can manage player accounts" ON player_accounts;
CREATE POLICY "Users can manage player accounts"
ON player_accounts
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM players
  WHERE players.id = player_accounts.player_id
  AND players.created_by = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM players
  WHERE players.id = player_accounts.player_id
  AND players.created_by = auth.uid()
));