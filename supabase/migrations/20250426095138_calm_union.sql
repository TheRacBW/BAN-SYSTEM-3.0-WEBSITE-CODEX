/*
  # Add strategy ratings and counters

  1. New Tables
    - `strategy_ratings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `strategy_id` (uuid, references strategies)
      - `effectiveness` (integer, 0-100)
      - `counterability` (integer, 0-100)
      - `created_at` (timestamp)
    
    - `strategy_counters`
      - `id` (uuid, primary key)
      - `base_strategy_id` (uuid, references strategies)
      - `counter_strategy_id` (uuid, references strategies)
      - `user_id` (uuid, references users)
      - `effectiveness` (integer, 0-100)
      - `created_at` (timestamp)
    
    - `saved_strategies` (already exists, adding index)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create strategy_ratings table
CREATE TABLE strategy_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  strategy_id uuid REFERENCES strategies(id) NOT NULL,
  effectiveness integer CHECK (effectiveness >= 0 AND effectiveness <= 100),
  counterability integer CHECK (counterability >= 0 AND counterability <= 100),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, strategy_id)
);

ALTER TABLE strategy_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read all ratings
CREATE POLICY "Users can read all ratings"
  ON strategy_ratings
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can rate strategies once
CREATE POLICY "Users can rate strategies"
  ON strategy_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
  ON strategy_ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create strategy_counters table
CREATE TABLE strategy_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_strategy_id uuid REFERENCES strategies(id) NOT NULL,
  counter_strategy_id uuid REFERENCES strategies(id) NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  effectiveness integer CHECK (effectiveness >= 0 AND effectiveness <= 100),
  created_at timestamptz DEFAULT now(),
  UNIQUE(base_strategy_id, counter_strategy_id, user_id)
);

ALTER TABLE strategy_counters ENABLE ROW LEVEL SECURITY;

-- Users can read all counter strategies
CREATE POLICY "Users can read all counter strategies"
  ON strategy_counters
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can submit counter strategies
CREATE POLICY "Users can submit counter strategies"
  ON strategy_counters
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own counter submissions
CREATE POLICY "Users can update own counter submissions"
  ON strategy_counters
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX idx_strategy_ratings_strategy_id ON strategy_ratings(strategy_id);
CREATE INDEX idx_strategy_counters_base_strategy_id ON strategy_counters(base_strategy_id);
CREATE INDEX idx_saved_strategies_user_id ON saved_strategies(user_id);

-- Function to update strategy stats
CREATE OR REPLACE FUNCTION update_strategy_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update effectiveness and counterability averages
  UPDATE strategies
  SET 
    effectiveness = (
      SELECT COALESCE(AVG(effectiveness), 50)
      FROM strategy_ratings
      WHERE strategy_id = NEW.strategy_id
    ),
    counterability = (
      SELECT COALESCE(AVG(counterability), 50)
      FROM strategy_ratings
      WHERE strategy_id = NEW.strategy_id
    )
  WHERE id = NEW.strategy_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats when ratings change
CREATE TRIGGER update_strategy_stats_on_rating
  AFTER INSERT OR UPDATE
  ON strategy_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_strategy_stats();

-- Function to update strategy popularity
CREATE OR REPLACE FUNCTION update_strategy_popularity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE strategies
  SET popularity = (
    SELECT COUNT(*)
    FROM saved_strategies
    WHERE strategy_id = NEW.strategy_id
  )
  WHERE id = NEW.strategy_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update popularity when strategies are saved/unsaved
CREATE TRIGGER update_strategy_popularity_on_save
  AFTER INSERT OR DELETE
  ON saved_strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_strategy_popularity();