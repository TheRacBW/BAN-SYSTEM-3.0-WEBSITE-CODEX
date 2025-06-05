/*
  # Add Owned Kits and Presets Tables
  
  1. Changes
    - Create owned_kits and kit_presets tables if they don't exist
    - Add missing indexes and policies
    - Handle existing tables gracefully
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create owned_kits table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'owned_kits') THEN
    CREATE TABLE owned_kits (
      user_id uuid REFERENCES users(id) ON DELETE CASCADE,
      kit_id uuid REFERENCES kits(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (user_id, kit_id)
    );
  END IF;
END $$;

-- Create kit_presets table if it doesn't exist
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
  END IF;
END $$;

-- Enable RLS
ALTER TABLE owned_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_presets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own owned kits" ON owned_kits;
DROP POLICY IF EXISTS "Users can manage owned kits" ON owned_kits;
DROP POLICY IF EXISTS "Users can read own presets" ON kit_presets;
DROP POLICY IF EXISTS "Users can manage presets" ON kit_presets;

-- Recreate policies for owned_kits
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

-- Recreate policies for kit_presets
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

-- Create indexes if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_owned_kits_user_id'
  ) THEN
    CREATE INDEX idx_owned_kits_user_id ON owned_kits(user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_owned_kits_kit_id'
  ) THEN
    CREATE INDEX idx_owned_kits_kit_id ON owned_kits(kit_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_kit_presets_user_id'
  ) THEN
    CREATE INDEX idx_kit_presets_user_id ON kit_presets(user_id);
  END IF;
END $$;