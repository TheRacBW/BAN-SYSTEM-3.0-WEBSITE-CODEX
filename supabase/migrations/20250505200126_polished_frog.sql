/*
  # Add Player Tracking System
  
  1. New Tables
    - `players`
      - `id` (uuid, primary key)
      - `created_by` (uuid, references users)
      - `alias` (text) - Player's known alias/nickname
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `player_accounts`
      - `id` (uuid, primary key)
      - `player_id` (uuid, references players)
      - `username` (text) - Account username
      - `created_at` (timestamp)
    
    - `player_teammates`
      - `player_id` (uuid, references players)
      - `teammate_id` (uuid, references players)
      - `created_at` (timestamp)
      - Primary key is (player_id, teammate_id)
    
    - `player_strategies`
      - `id` (uuid, primary key)
      - `player_id` (uuid, references players)
      - `image_url` (text)
      - `kit_ids` (uuid[])
      - `teammate_ids` (uuid[])
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create player_accounts table
CREATE TABLE player_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  username text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create player_teammates table
CREATE TABLE player_teammates (
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  teammate_id uuid REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, teammate_id)
);

-- Create player_strategies table
CREATE TABLE player_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  kit_ids uuid[] NOT NULL,
  teammate_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_teammates ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_strategies ENABLE ROW LEVEL SECURITY;

-- Create policies for players
CREATE POLICY "Users can read all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own players"
  ON players
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create policies for player_accounts
CREATE POLICY "Users can read all player accounts"
  ON player_accounts
  FOR SELECT
  TO authenticated
  USING (true);

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

-- Create policies for player_teammates
CREATE POLICY "Users can read all player teammates"
  ON player_teammates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage player teammates"
  ON player_teammates
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM players
    WHERE players.id = player_teammates.player_id
    AND players.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM players
    WHERE players.id = player_teammates.player_id
    AND players.created_by = auth.uid()
  ));

-- Create policies for player_strategies
CREATE POLICY "Users can read all player strategies"
  ON player_strategies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage player strategies"
  ON player_strategies
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM players
    WHERE players.id = player_strategies.player_id
    AND players.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM players
    WHERE players.id = player_strategies.player_id
    AND players.created_by = auth.uid()
  ));

-- Create indexes
CREATE INDEX idx_players_created_by ON players(created_by);
CREATE INDEX idx_player_accounts_player_id ON player_accounts(player_id);
CREATE INDEX idx_player_teammates_player_id ON player_teammates(player_id);
CREATE INDEX idx_player_teammates_teammate_id ON player_teammates(teammate_id);
CREATE INDEX idx_player_strategies_player_id ON player_strategies(player_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for players
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();