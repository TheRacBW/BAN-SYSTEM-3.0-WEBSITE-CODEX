/*
  # Add starred kit support for player strategies
  
  1. Changes
    - Add starred_kit_id column to player_strategies table
    - Add foreign key constraint to ensure data integrity
    - Allow NULL values for optional starring
  
  2. Security
    - Maintain existing RLS policies
    - No additional security changes needed
*/

-- Add starred_kit_id to player_strategies
ALTER TABLE player_strategies
ADD COLUMN starred_kit_id uuid REFERENCES kits(id);

-- Add foreign key constraint
ALTER TABLE player_strategies
ADD CONSTRAINT fk_starred_kit
FOREIGN KEY (starred_kit_id)
REFERENCES kits(id)
ON DELETE SET NULL;