/*
  # Create Username Change Log Table
  
  1. Changes
    - Create username_change_log table for tracking username changes
    - Use correct schema with verified boolean instead of status
    - Add all necessary columns for migration system
    - Add proper indexes for performance
  
  2. Security
    - Enable RLS policies
    - Add appropriate access controls
*/

-- Create username_change_log table with correct schema
CREATE TABLE IF NOT EXISTS username_change_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    old_username text NOT NULL,
    new_username text NOT NULL,
    user_id bigint NOT NULL,
    records_updated integer NOT NULL,
    confidence_score integer,
    merged_at timestamp with time zone DEFAULT now(),
    verified boolean DEFAULT false,
    notes text
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_username_change_log_user_id ON username_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_username_change_log_verified ON username_change_log(verified);
CREATE INDEX IF NOT EXISTS idx_username_change_log_merged_at ON username_change_log(merged_at);

-- Enable RLS
ALTER TABLE username_change_log ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access
CREATE POLICY "Admins can read all username changes"
  ON username_change_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can insert username changes"
  ON username_change_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update username changes"
  ON username_change_log
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Add comment for documentation
COMMENT ON TABLE username_change_log IS 'Tracks username changes detected during migration process';
COMMENT ON COLUMN username_change_log.verified IS 'Boolean flag indicating if the username change has been verified';
COMMENT ON COLUMN username_change_log.confidence_score IS 'Confidence score for the username change detection';
COMMENT ON COLUMN username_change_log.records_updated IS 'Number of records updated during the merge process'; 