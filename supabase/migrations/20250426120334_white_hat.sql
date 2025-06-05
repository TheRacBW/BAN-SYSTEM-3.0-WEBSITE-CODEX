/*
  # Fix User Policies and Constraints
  
  1. Changes
    - Fix infinite recursion in user policies
    - Update user creation handling
    - Fix duplicate key violations
    
  2. Security
    - Simplify RLS policies to prevent recursion
    - Maintain proper access control
*/

-- Drop existing policies that are causing recursion
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can read usernames" ON public.users;

-- Create simplified policies
CREATE POLICY "Users can read public data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update handle_auth_user_creation function to handle conflicts properly
CREATE OR REPLACE FUNCTION handle_auth_user_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure email is provided
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Get username from metadata or generate one
  NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  IF NEW.raw_user_meta_data->>'username' IS NULL THEN
    NEW.raw_user_meta_data := jsonb_set(
      NEW.raw_user_meta_data,
      '{username}',
      to_jsonb('user_' || substring(NEW.id::text, 1, 8))
    );
  END IF;

  -- Always store username and email in lowercase
  NEW.raw_user_meta_data := jsonb_set(
    NEW.raw_user_meta_data,
    '{username}',
    to_jsonb(lower(NEW.raw_user_meta_data->>'username'))
  );

  -- Create user profile with ON CONFLICT DO NOTHING to prevent duplicate key errors
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
    lower(NEW.email) IN (
      'amadoh0905@gmail.com',
      'johanbarron20@gmail.com',
      'theraccoonmolester@temp.metaguardian.com'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;