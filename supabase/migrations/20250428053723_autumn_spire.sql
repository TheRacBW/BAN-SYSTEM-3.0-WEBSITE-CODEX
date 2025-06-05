/*
  # Fix owned kits and presets tables
  
  1. Changes
    - Safely handle existing tables
    - Update policies if needed
    - Add missing indexes
  
  2. Security
    - Maintain RLS policies
    - Ensure proper access control
*/

-- Safely create or update owned_kits table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'owned_kits') THEN
    CREATE TABLE owned_kits (
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      kit_id uuid REFERENCES kits(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (user_id, kit_id)
    );

    -- Enable RLS
    ALTER TABLE owned_kits ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Users can read own owned kits"
      ON owned_kits
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can manage owned kits"
      ON owned_kits
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_owned_kits_user_id ON owned_kits(user_id);
    CREATE INDEX IF NOT EXISTS idx_owned_kits_kit_id ON owned_kits(kit_id);
  END IF;
END $$;

-- Safely create or update kit_presets table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'kit_presets') THEN
    CREATE TABLE kit_presets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      kit_ids uuid[] NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE kit_presets ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Users can read own presets"
      ON kit_presets
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can manage presets"
      ON kit_presets
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_kit_presets_user_id ON kit_presets(user_id);
  END IF;
END $$;