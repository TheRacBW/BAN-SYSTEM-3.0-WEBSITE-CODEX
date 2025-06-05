/*
  # Update strategy ID columns to text type

  1. Changes
    - Modify strategies table to use text IDs instead of UUIDs
    - Update related tables to match the new ID type
    - Preserve existing relationships and constraints
  
  2. Security
    - Maintain existing RLS policies
    - No changes to security settings required
*/

-- First, drop existing foreign key constraints
ALTER TABLE saved_strategies
DROP CONSTRAINT saved_strategies_strategy_id_fkey;

ALTER TABLE strategy_ratings 
DROP CONSTRAINT strategy_ratings_strategy_id_fkey;

ALTER TABLE strategy_counters
DROP CONSTRAINT strategy_counters_base_strategy_id_fkey,
DROP CONSTRAINT strategy_counters_counter_strategy_id_fkey;

-- Update the strategies table primary key type
ALTER TABLE strategies
ALTER COLUMN id TYPE text;

-- Update related tables' foreign key columns
ALTER TABLE saved_strategies
ALTER COLUMN strategy_id TYPE text;

ALTER TABLE strategy_ratings
ALTER COLUMN strategy_id TYPE text;

ALTER TABLE strategy_counters
ALTER COLUMN base_strategy_id TYPE text,
ALTER COLUMN counter_strategy_id TYPE text;

-- Recreate foreign key constraints
ALTER TABLE saved_strategies
ADD CONSTRAINT saved_strategies_strategy_id_fkey 
FOREIGN KEY (strategy_id) REFERENCES strategies(id);

ALTER TABLE strategy_ratings
ADD CONSTRAINT strategy_ratings_strategy_id_fkey 
FOREIGN KEY (strategy_id) REFERENCES strategies(id);

ALTER TABLE strategy_counters
ADD CONSTRAINT strategy_counters_base_strategy_id_fkey 
FOREIGN KEY (base_strategy_id) REFERENCES strategies(id),
ADD CONSTRAINT strategy_counters_counter_strategy_id_fkey 
FOREIGN KEY (counter_strategy_id) REFERENCES strategies(id);