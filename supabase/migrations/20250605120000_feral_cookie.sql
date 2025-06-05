/*
  # Add Roblox cookie settings

  1. New Tables
    - roblox_settings
      - id (text, primary key)
      - cookie (text)
      - updated_at (timestamp)

  2. Security
    - Only admins can modify cookie
    - Anyone can read cookie (for functions)
*/

CREATE TABLE roblox_settings (
  id text PRIMARY KEY,
  cookie text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE roblox_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read roblox settings"
  ON roblox_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify roblox settings"
  ON roblox_settings
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

INSERT INTO roblox_settings (id, cookie)
VALUES ('global', '')
ON CONFLICT (id) DO NOTHING;
