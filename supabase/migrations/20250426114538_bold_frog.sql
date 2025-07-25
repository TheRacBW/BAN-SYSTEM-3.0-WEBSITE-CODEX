/*
  # Fix admin user creation and policies

  1. Changes
    - Properly handle admin user creation without violating foreign key constraints
    - Ensure case-insensitive username and email handling
    - Update RLS policies for proper access control

  2. Security
    - Enable RLS on users table
    - Add policies for user profile access
    - Update existing policy for public username access
*/

-- First ensure the admin user exists in auth.users with correct credentials
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
  'theraccoonmolester@temp.metaguardian.com',
  crypt('THUNDERGRAYAR006', gen_salt('bf')),
  now(),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"theraccoonmolester"}',
  false,
  'authenticated',
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- Update or create admin user profile
INSERT INTO public.users (
  id,
  email,
  username,
  is_admin
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'theraccoonmolester@temp.metaguardian.com',
  'theraccoonmolester',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = EXCLUDED.username,
  is_admin = true;

-- Update handle_auth_user_creation function to handle case-insensitive usernames
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

  -- Always store username in lowercase
  NEW.raw_user_meta_data := jsonb_set(
    NEW.raw_user_meta_data,
    '{username}',
    to_jsonb(lower(NEW.raw_user_meta_data->>'username'))
  );

  -- Create user profile
  INSERT INTO public.users (
    id,
    email,
    username,
    is_admin
  )
  VALUES (
    NEW.id,
    lower(NEW.email),
    lower(NEW.raw_user_meta_data->>'username'),
    lower(NEW.email) = 'theraccoonmolester@temp.metaguardian.com'
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

-- Update existing users to have lowercase usernames and emails
UPDATE public.users
SET 
  username = lower(username),
  email = lower(email);

-- Update existing auth users to have lowercase emails and usernames in metadata
UPDATE auth.users
SET 
  email = lower(email),
  raw_user_meta_data = jsonb_set(
    raw_user_meta_data,
    '{username}',
    to_jsonb(lower(raw_user_meta_data->>'username'))
  )
WHERE raw_user_meta_data->>'username' IS NOT NULL;

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