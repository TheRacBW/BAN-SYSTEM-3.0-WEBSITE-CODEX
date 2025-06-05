/*
  # Fix authentication system

  1. Changes
    - Make email nullable in users table
    - Ensure username is required and unique
    - Update RLS policies for user management
    - Add trigger for handling user creation/updates
    - Add special case for admin user

  2. Security
    - Enable RLS on users table
    - Add policies for user profile management
*/

-- Make email nullable in users table
ALTER TABLE public.users
ALTER COLUMN email DROP NOT NULL;

-- Ensure username is required and unique
ALTER TABLE public.users
ALTER COLUMN username SET NOT NULL;

-- Create a function to handle user creation/updates
CREATE OR REPLACE FUNCTION handle_auth_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- For new users without a username, generate one from their id
  IF NEW.raw_user_meta_data->>'username' IS NULL THEN
    NEW.raw_user_meta_data := jsonb_set(
      COALESCE(NEW.raw_user_meta_data, '{}'::jsonb),
      '{username}',
      to_jsonb('user_' || substring(NEW.id::text, 1, 8))
    );
  END IF;

  -- Insert or update the public.users record
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substring(NEW.id::text, 1, 8)
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    username = EXCLUDED.username;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_auth_user_creation();

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

-- Ensure admin user exists with correct credentials
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'TheRaccoonMolester@temp.metaguardian.com',
  crypt('THUNDERGRAYAR006', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"TheRaccoonMolester"}',
  false,
  'authenticated',
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Update admin user in public.users table
INSERT INTO public.users (
  id,
  email,
  username,
  is_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'TheRaccoonMolester@temp.metaguardian.com',
  'TheRaccoonMolester',
  true
)
ON CONFLICT (id) DO UPDATE SET
  is_admin = true,
  email = 'TheRaccoonMolester@temp.metaguardian.com',
  username = 'TheRaccoonMolester';