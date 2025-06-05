/*
  # Create kits table
  
  1. New Tables
    - `kits`
      - `id` (uuid, primary key) - Unique identifier for each kit
      - `created_at` (timestamptz) - When the kit was created
      - `name` (text) - Name of the kit
      - `image_url` (text) - URL to the kit's image
      - `type` (text) - Type of the kit (Fighter, Movement, Economy, etc.)
      - `pay_locked` (boolean) - Whether the kit requires payment to unlock
  
  2. Security
    - Enable RLS on `kits` table
    - Add policies for:
      - Authenticated users can read all kits
      - Only admins can insert/update/delete kits
*/

-- Create the kits table
CREATE TABLE IF NOT EXISTS public.kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  type TEXT NOT NULL,
  pay_locked BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

-- Create policy for reading kits (all authenticated users can read)
CREATE POLICY "Anyone can read kits"
  ON public.kits
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for inserting kits (only admins)
CREATE POLICY "Only admins can insert kits"
  ON public.kits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Create policy for updating kits (only admins)
CREATE POLICY "Only admins can update kits"
  ON public.kits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );

-- Create policy for deleting kits (only admins)
CREATE POLICY "Only admins can delete kits"
  ON public.kits
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = true
    )
  );