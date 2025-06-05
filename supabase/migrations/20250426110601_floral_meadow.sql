/*
  # Add Admin User

  1. Changes
    - Add admin user with specified credentials
    - Set admin privileges
*/

-- Create a function to update admin status
CREATE OR REPLACE FUNCTION set_admin_for_email()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET is_admin = true
  WHERE email = 'TheRaccoonMolester';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT set_admin_for_email();

-- Drop the function after use
DROP FUNCTION set_admin_for_email();