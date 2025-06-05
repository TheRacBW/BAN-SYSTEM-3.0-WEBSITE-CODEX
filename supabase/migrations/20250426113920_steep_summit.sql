/*
  # Fix Authentication Issues

  1. Changes
    - Set up admin user profile
    - Update user profile handling
    - Add missing indexes and constraints

  2. Security
    - Ensure proper RLS policies
    - Fix admin user permissions
*/

-- Create admin user profile if it doesn't exist
INSERT INTO public.users (
  id,
  email,
  username,
  is_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'TheRaccoonMolester@temp.metaguardian.com',
  'theraccoonmolester',
  true
)
ON CONFLICT (id) DO UPDATE SET
  is_admin = true,
  email = EXCLUDED.email,
  username = EXCLUDED.username;

-- Update handle_auth_user_creation function
CREATE OR REPLACE FUNCTION handle_auth_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Get username from metadata or generate one
  NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  IF NEW.raw_user_meta_data->>'username' IS NULL THEN
    NEW.raw_user_meta_data := jsonb_set(
      NEW.raw_user_meta_data,
      '{username}',
      to_jsonb('user_' || substring(NEW.id::text, 1, 8))
    );
  END IF;

  -- Create user profile
  INSERT INTO public.users (
    id,
    email,
    username,
    is_admin
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'username',
    NEW.email = 'TheRaccoonMolester@temp.metaguardian.com'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    is_admin = EXCLUDED.is_admin;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_auth_user_creation();

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- Update RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add public read access for usernames
CREATE POLICY "Anyone can read usernames"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);