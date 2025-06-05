/*
  # Fix Strategy Removal Policies

  1. Changes
    - Add RLS policy for strategy deletion
    - Add RLS policy for strategy updates
    - Remove existing policies that conflict with new ones
  
  2. Security
    - Enable RLS on strategies table (already enabled)
    - Add policy for users to delete their own strategies
    - Add policy for users to update their own strategies
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can delete own strategies" ON strategies;
DROP POLICY IF EXISTS "Users can update own strategies" ON strategies;

-- Create new policies for strategy deletion and updates
CREATE POLICY "Users can delete own strategies"
ON strategies
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
ON strategies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);