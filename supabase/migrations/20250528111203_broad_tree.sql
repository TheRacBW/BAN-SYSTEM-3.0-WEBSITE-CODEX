/*
  # Add YouTube channel and fix starred kit constraint
  
  1. Changes
    - Add youtube_channel column to players table
    - Fix starred kit constraint if it exists
    - Update foreign key constraint
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add youtube_channel to players if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' 
    AND column_name = 'youtube_channel'
  ) THEN
    ALTER TABLE players
    ADD COLUMN youtube_channel text;
  END IF;
END $$;

-- Drop existing constraint if it exists
ALTER TABLE player_strategies 
DROP CONSTRAINT IF EXISTS fk_starred_kit;

-- Add proper foreign key constraint
ALTER TABLE player_strategies
ADD CONSTRAINT fk_starred_kit
FOREIGN KEY (starred_kit_id)
REFERENCES kits(id)
ON DELETE SET NULL;