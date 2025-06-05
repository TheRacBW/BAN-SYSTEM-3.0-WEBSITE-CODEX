/*
  # Add Strategy Tags and Active Status
  
  1. New Tables
    - `strategy_tags`
      - `user_id` (uuid, references users)
      - `strategy_id` (text, references strategies)
      - `tags` (text array) - Array of tags for the strategy
      - `is_active` (boolean) - Whether the strategy is active
      - `created_at` (timestamp)
      - Primary key is (user_id, strategy_id)
  
  2. Security
    - Enable RLS on strategy_tags table
    - Add policies for authenticated users
*/

-- Create strategy_tags table
CREATE TABLE strategy_tags (
  user_id uuid REFERENCES users(id),
  strategy_id text REFERENCES strategies(id),
  tags text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, strategy_id)
);

-- Enable RLS
ALTER TABLE strategy_tags ENABLE ROW LEVEL SECURITY;

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

-- Create indexes for better performance
CREATE INDEX idx_strategy_tags_user_id ON strategy_tags(user_id);
CREATE INDEX idx_strategy_tags_strategy_id ON strategy_tags(strategy_id);