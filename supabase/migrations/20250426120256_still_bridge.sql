/*
  # Update Authentication System and Add Super Admins
  
  1. Changes
    - Make email required for all users
    - Add super admin access for specified users
    - Update existing users to ensure email compliance
    
  2. Security
    - Add RLS policies for admin access
    - Ensure proper access control for user management
*/

-- First ensure email is required
ALTER TABLE public.users
ALTER COLUMN email SET NOT NULL;

-- Create function to set super admins
CREATE OR REPLACE FUNCTION set_super_admins()
RETURNS void AS $$
BEGIN
  -- Update specified users to be super admins
  UPDATE public.users
  SET is_admin = true
  WHERE email IN (
    'amadoh0905@gmail.com',
    'johanbarron20@gmail.com',
    'theraccoonmolester@temp.metaguardian.com'
  );
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT set_super_admins();

-- Drop the function after use
DROP FUNCTION set_super_admins();

-- Update handle_auth_user_creation function to require email
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
    lower(NEW.email) IN (
      'amadoh0905@gmail.com',
      'johanbarron20@gmail.com',
      'theraccoonmolester@temp.metaguardian.com'
    )
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

-- Update RLS policies for admin access
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
CREATE POLICY "Admins can read all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid())
    OR auth.uid() = id
  );

DROP POLICY IF EXISTS "Admins can update users" ON public.users;
CREATE POLICY "Admins can update users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid())
    OR auth.uid() = id
  )
  WITH CHECK (
    (SELECT is_admin FROM public.users WHERE id = auth.uid())
    OR auth.uid() = id
  );