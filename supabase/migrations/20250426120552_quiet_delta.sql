/*
  # Add Admin Strategy Management Policies

  1. Changes
    - Add policies for admin strategy management
    - Allow admins to delete any strategy
    - Allow admins to update any strategy
    
  2. Security
    - Maintain RLS
    - Only admins can delete/update any strategy
    - Regular users can still manage their own strategies
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can delete any strategy" ON strategies;
DROP POLICY IF EXISTS "Admins can update any strategy" ON strategies;

-- Create new admin policies
CREATE POLICY "Admins can delete any strategy"
ON strategies
FOR DELETE
TO authenticated
USING (
  (SELECT is_admin FROM users WHERE id = auth.uid())
  OR user_id = auth.uid()
);

CREATE POLICY "Admins can update any strategy"
ON strategies
FOR UPDATE
TO authenticated
USING (
  (SELECT is_admin FROM users WHERE id = auth.uid())
  OR user_id = auth.uid()
)
WITH CHECK (
  (SELECT is_admin FROM users WHERE id = auth.uid())
  OR user_id = auth.uid()
);