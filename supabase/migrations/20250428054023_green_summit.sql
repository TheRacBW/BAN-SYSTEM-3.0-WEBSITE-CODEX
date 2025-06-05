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