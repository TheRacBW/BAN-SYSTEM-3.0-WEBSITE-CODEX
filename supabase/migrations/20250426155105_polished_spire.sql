/*
  # Update strategy tags table and policies

  1. Changes
    - Add IF NOT EXISTS checks
    - Update policies if table exists
    - Add missing indexes
  
  2. Security
    - Maintain RLS policies
    - Ensure proper access control
*/

-- Create strategy_tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS strategy_tags (
  user_id uuid REFERENCES users(id),
  strategy_id text REFERENCES strategies(id),
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, strategy_id)
);

-- Enable RLS
ALTER TABLE strategy_tags ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own strategy tags" ON strategy_tags;
DROP POLICY IF EXISTS "Users can insert own strategy tags" ON strategy_tags;
DROP POLICY IF EXISTS "Users can update own strategy tags" ON strategy_tags;
DROP POLICY IF EXISTS "Users can delete own strategy tags" ON strategy_tags;

-- Create policies
CREATE POLICY "Users can read own strategy tags"
  ON strategy_tags
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategy tags"
  ON strategy_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy tags"
  ON strategy_tags
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategy tags"
  ON strategy_tags
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_strategy_tags_user_id'
  ) THEN
    CREATE INDEX idx_strategy_tags_user_id ON strategy_tags(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_strategy_tags_strategy_id'
  ) THEN
    CREATE INDEX idx_strategy_tags_strategy_id ON strategy_tags(strategy_id);
  END IF;
END $$;