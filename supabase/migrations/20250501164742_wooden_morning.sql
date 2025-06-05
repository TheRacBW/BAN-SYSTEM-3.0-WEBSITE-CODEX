/*
  # Add Custom Ads Support
  
  1. New Tables
    - `custom_ads`
      - `id` (uuid, primary key)
      - `name` (text)
      - `image_url` (text)
      - `link_url` (text)
      - `enabled` (boolean)
      - `weight` (integer) - For controlling rotation probability
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS
    - Only admins can manage ads
    - Anyone can view enabled ads
*/

CREATE TABLE custom_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  link_url text NOT NULL,
  enabled boolean DEFAULT true,
  weight integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_ads ENABLE ROW LEVEL SECURITY;

-- Anyone can read enabled ads
CREATE POLICY "Anyone can read enabled ads"
  ON custom_ads
  FOR SELECT
  TO authenticated
  USING (enabled = true);

-- Only admins can manage ads
CREATE POLICY "Only admins can manage ads"
  ON custom_ads
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

-- Add ad_type column to ad_settings
ALTER TABLE ad_settings 
ADD COLUMN ad_type text DEFAULT 'google' CHECK (ad_type IN ('google', 'custom'));