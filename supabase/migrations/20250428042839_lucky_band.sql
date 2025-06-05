/*
  # Add Weekly Strategy Encounters
  
  1. New Tables
    - `strategy_encounters`
      - `strategy_id` (text, references strategies)
      - `user_id` (uuid, references users)
      - `week_start` (date) - Start of the week when encounter was recorded
      - Primary key is (strategy_id, user_id, week_start)
  
  2. Security
    - Enable RLS on strategy_encounters table
    - Add policies for authenticated users
*/

-- Create strategy_encounters table
CREATE TABLE strategy_encounters (
  strategy_id text REFERENCES strategies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (strategy_id, user_id, week_start)
);

-- Enable RLS
ALTER TABLE strategy_encounters ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can read encounters"
  ON strategy_encounters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can record encounters"
  ON strategy_encounters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove encounters"
  ON strategy_encounters
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_strategy_encounters_strategy_id ON strategy_encounters(strategy_id);
CREATE INDEX idx_strategy_encounters_user_id ON strategy_encounters(user_id);
CREATE INDEX idx_strategy_encounters_week_start ON strategy_encounters(week_start);