/*
  # Add Kit Ownership System
  
  1. New Tables
    - `owned_kits`
      - `user_id` (uuid, references users)
      - `kit_id` (uuid, references kits)
      - `created_at` (timestamp)
      - Primary key is (user_id, kit_id)
    
    - `kit_presets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `name` (text)
      - `kit_ids` (uuid array)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create owned_kits table
CREATE TABLE owned_kits (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  kit_id uuid REFERENCES kits(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, kit_id)
);

-- Create kit_presets table
CREATE TABLE kit_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kit_ids uuid[] NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE owned_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_presets ENABLE ROW LEVEL SECURITY;

-- Policies for owned_kits
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

-- Policies for kit_presets
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

-- Create indexes
CREATE INDEX idx_owned_kits_user_id ON owned_kits(user_id);
CREATE INDEX idx_owned_kits_kit_id ON owned_kits(kit_id);
CREATE INDEX idx_kit_presets_user_id ON kit_presets(user_id);