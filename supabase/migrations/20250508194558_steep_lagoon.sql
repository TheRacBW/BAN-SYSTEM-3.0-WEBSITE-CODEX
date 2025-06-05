/*
  # Add Account Rank System
  
  1. New Tables
    - `account_ranks`
      - `id` (uuid, primary key)
      - `name` (text) - e.g., Bronze, Silver, etc.
      - `image_url` (text)
      - `created_at` (timestamp)
    
    - `player_account_ranks`
      - `account_id` (uuid, references player_accounts)
      - `rank_id` (uuid, references account_ranks)
      - `created_at` (timestamp)
      - Primary key is (account_id, rank_id)
    
    - `rank_update_claims`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references player_accounts)
      - `rank_id` (uuid, references account_ranks)
      - `proof_url` (text)
      - `status` (text) - pending, approved, rejected
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create account_ranks table
CREATE TABLE account_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create player_account_ranks table
CREATE TABLE player_account_ranks (
  account_id uuid REFERENCES player_accounts(id) ON DELETE CASCADE,
  rank_id uuid REFERENCES account_ranks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (account_id, rank_id)
);

-- Create rank_update_claims table
CREATE TABLE rank_update_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES player_accounts(id) ON DELETE CASCADE,
  rank_id uuid REFERENCES account_ranks(id) ON DELETE CASCADE,
  proof_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE account_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_account_ranks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_update_claims ENABLE ROW LEVEL SECURITY;

-- Policies for account_ranks
CREATE POLICY "Anyone can read ranks"
  ON account_ranks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage ranks"
  ON account_ranks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Policies for player_account_ranks
CREATE POLICY "Anyone can read account ranks"
  ON player_account_ranks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage account ranks"
  ON player_account_ranks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Policies for rank_update_claims
CREATE POLICY "Users can read own claims"
  ON rank_update_claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_accounts
      WHERE player_accounts.id = rank_update_claims.account_id
      AND EXISTS (
        SELECT 1 FROM players
        WHERE players.id = player_accounts.player_id
        AND players.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users can submit claims"
  ON rank_update_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_accounts
      WHERE player_accounts.id = rank_update_claims.account_id
      AND EXISTS (
        SELECT 1 FROM players
        WHERE players.id = player_accounts.player_id
        AND players.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Only admins can manage claims"
  ON rank_update_claims
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Insert default ranks
INSERT INTO account_ranks (name, image_url) VALUES
  ('Bronze', 'https://example.com/ranks/bronze.png'),
  ('Silver', 'https://example.com/ranks/silver.png'),
  ('Gold', 'https://example.com/ranks/gold.png'),
  ('Platinum', 'https://example.com/ranks/platinum.png'),
  ('Diamond', 'https://example.com/ranks/diamond.png'),
  ('Emerald', 'https://example.com/ranks/emerald.png'),
  ('Nightmare', 'https://example.com/ranks/nightmare.png')
ON CONFLICT DO NOTHING;