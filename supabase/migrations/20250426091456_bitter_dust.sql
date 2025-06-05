/*
  # Add user creation policy

  1. Security Changes
    - Add policy to allow users to create their own profile
    - This policy is necessary for the signup flow to work correctly

  2. Changes
    - Add INSERT policy for users table
*/

CREATE POLICY "Users can create their own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);