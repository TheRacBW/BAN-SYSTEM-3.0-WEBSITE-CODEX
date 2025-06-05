/*
  # Fix admin user setup

  1. Changes
    - Create admin user in auth.users table first
    - Create corresponding entry in public.users table
    - Set admin privileges
    - Ensure username uniqueness

  2. Security
    - Maintains RLS policies
    - Only affects admin user
*/

-- First, ensure the user exists in auth.users
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
  '{}',
  false,
  'authenticated',
  '',
  '',
  '',
  ''
)
ON CONFLICT (id) DO NOTHING;

-- Then create the corresponding entry in public.users
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

-- Ensure username uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users (username);