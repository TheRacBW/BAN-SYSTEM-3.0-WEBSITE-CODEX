/*
  # Add Advertisement Settings
  
  1. New Tables
    - `ad_settings`
      - `id` (text, primary key)
      - `enabled` (boolean) - Whether ads are enabled globally
      - `ad_client` (text) - Google AdSense client ID
      - `ad_slot` (text) - Google AdSense ad slot ID
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS
    - Only admins can modify settings
    - Anyone can read settings
*/

CREATE TABLE ad_settings (
  id text PRIMARY KEY,
  enabled boolean DEFAULT false,
  ad_client text,
  ad_slot text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ad_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ad settings
CREATE POLICY "Anyone can read ad settings"
  ON ad_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify ad settings
CREATE POLICY "Only admins can modify ad settings"
  ON ad_settings
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

-- Insert default settings
INSERT INTO ad_settings (id, enabled, ad_client, ad_slot)
VALUES ('global', false, '', '')
ON CONFLICT (id) DO NOTHING;