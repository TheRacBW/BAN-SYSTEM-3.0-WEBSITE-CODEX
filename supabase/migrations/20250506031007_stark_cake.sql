/*
  # Add Player Tracking System
  
  1. Changes
    - Safely handle existing tables
    - Update policies if needed
    - Add missing indexes
  
  2. Security
    - Maintain RLS policies
    - Ensure proper access control
*/

-- Safely create or update players table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'players') THEN
    CREATE TABLE players (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by uuid REFERENCES users(id) ON DELETE CASCADE,
      alias text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE players ENABLE ROW LEVEL SECURITY;

    -- Create policies
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

    -- Create index
    CREATE INDEX idx_players_created_by ON players(created_by);

    -- Create trigger for updated_at
    CREATE TRIGGER update_players_updated_at
      BEFORE UPDATE ON players
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Safely create or update player_accounts table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'player_accounts') THEN
    CREATE TABLE player_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id uuid REFERENCES players(id) ON DELETE CASCADE,
      username text NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE player_accounts ENABLE ROW LEVEL SECURITY;

    -- Create policies
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

    -- Create index
    CREATE INDEX idx_player_accounts_player_id ON player_accounts(player_id);
  END IF;
END $$;

-- Safely create or update player_teammates table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'player_teammates') THEN
    CREATE TABLE player_teammates (
      player_id uuid REFERENCES players(id) ON DELETE CASCADE,
      teammate_id uuid REFERENCES players(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (player_id, teammate_id)
    );

    -- Enable RLS
    ALTER TABLE player_teammates ENABLE ROW LEVEL SECURITY;

    -- Create policies
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

    -- Create indexes
    CREATE INDEX idx_player_teammates_player_id ON player_teammates(player_id);
    CREATE INDEX idx_player_teammates_teammate_id ON player_teammates(teammate_id);
  END IF;
END $$;

-- Safely create or update player_strategies table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'player_strategies') THEN
    CREATE TABLE player_strategies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id uuid REFERENCES players(id) ON DELETE CASCADE,
      image_url text NOT NULL,
      kit_ids uuid[] NOT NULL,
      teammate_ids uuid[] DEFAULT '{}',
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE player_strategies ENABLE ROW LEVEL SECURITY;

    -- Create policies
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

    -- Create index
    CREATE INDEX idx_player_strategies_player_id ON player_strategies(player_id);
  END IF;
END $$;