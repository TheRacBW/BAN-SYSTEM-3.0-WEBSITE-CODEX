/*
  # Initial schema setup for Meta Guardian

  1. New Tables
    - `users`
      - `id` (uuid, primary key, matches auth.users)
      - `email` (text, unique)
      - `is_admin` (boolean)
      - `created_at` (timestamp)
    
    - `strategies`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `name` (text)
      - `description` (text)
      - `kit_ids` (text array, exactly 5 kits)
      - `is_public` (boolean)
      - `effectiveness` (integer)
      - `counterability` (integer)
      - `win_rate` (decimal)
      - `popularity` (integer)
      - `is_trending` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `saved_strategies`
      - `user_id` (uuid, references users)
      - `strategy_id` (uuid, references strategies)
      - `saved_at` (timestamp)
      - Primary key is (user_id, strategy_id)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create strategies table
CREATE TABLE strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  name text NOT NULL,
  description text,
  kit_ids text[] NOT NULL CHECK (array_length(kit_ids, 1) = 5),
  is_public boolean DEFAULT false,
  effectiveness integer CHECK (effectiveness >= 0 AND effectiveness <= 100),
  counterability integer CHECK (counterability >= 0 AND counterability <= 100),
  win_rate decimal CHECK (win_rate >= 0 AND win_rate <= 1),
  popularity integer DEFAULT 0,
  is_trending boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;

-- Users can read public strategies
CREATE POLICY "Users can read public strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Users can read their own strategies
CREATE POLICY "Users can read own strategies"
  ON strategies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create strategies
CREATE POLICY "Users can create strategies"
  ON strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own strategies
CREATE POLICY "Users can update own strategies"
  ON strategies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own strategies
CREATE POLICY "Users can delete own strategies"
  ON strategies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create saved_strategies table
CREATE TABLE saved_strategies (
  user_id uuid REFERENCES users(id),
  strategy_id uuid REFERENCES strategies(id),
  saved_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, strategy_id)
);

ALTER TABLE saved_strategies ENABLE ROW LEVEL SECURITY;

-- Users can read their saved strategies
CREATE POLICY "Users can read own saved strategies"
  ON saved_strategies
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can save strategies
CREATE POLICY "Users can save strategies"
  ON saved_strategies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can unsave strategies
CREATE POLICY "Users can unsave strategies"
  ON saved_strategies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update strategy updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE
  ON strategies
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();