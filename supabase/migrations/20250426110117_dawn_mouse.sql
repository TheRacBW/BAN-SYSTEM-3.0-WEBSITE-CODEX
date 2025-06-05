/*
  # Add Username Column

  1. Changes
    - Add username column to users table
    - Add unique constraint
    - Set default usernames for existing users
  
  2. Security
    - Maintain existing RLS policies
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

-- Add username column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    -- Add the column
    ALTER TABLE users ADD COLUMN username text;
    
    -- Update existing users with generated usernames
    UPDATE users
    SET username = generate_unique_username(email)
    WHERE username IS NULL;
    
    -- Make username required and unique
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;