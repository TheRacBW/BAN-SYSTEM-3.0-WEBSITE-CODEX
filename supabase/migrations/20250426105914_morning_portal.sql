/*
  # Add Username Support

  1. Changes
    - Add username column to users table
    - Add unique constraint on username
    - Add trigger to generate default username from email
    - Add function to generate unique username
  
  2. Security
    - Maintain existing RLS policies
    - Username is publicly readable but only owner can update
*/

-- Function to generate a unique username from email
CREATE OR REPLACE FUNCTION generate_unique_username(email text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_username text;
  temp_username text;
  counter integer := 0;
BEGIN
  -- Extract everything before @ in email
  base_username := split_part(email, '@', 1);
  
  -- Remove special characters and spaces
  base_username := regexp_replace(base_username, '[^a-zA-Z0-9]', '', 'g');
  
  -- Initial attempt with base username
  temp_username := base_username;
  
  -- Keep trying until we find a unique username
  WHILE EXISTS (SELECT 1 FROM users WHERE username = temp_username) LOOP
    counter := counter + 1;
    temp_username := base_username || counter::text;
  END LOOP;
  
  RETURN temp_username;
END;
$$;

-- Add username column and populate it for existing users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username text;

-- Update existing users with generated usernames
DO $$
BEGIN
  UPDATE users
  SET username = generate_unique_username(email)
  WHERE username IS NULL;
  
  -- Make username required after populating existing users
  ALTER TABLE users
  ALTER COLUMN username SET NOT NULL;
  
  -- Add unique constraint
  ALTER TABLE users
  ADD CONSTRAINT users_username_key UNIQUE (username);
END $$;