/*
  # Update rank images and management
  
  1. Changes
    - Update rank images with correct URLs
    - Add proper rank management policies
    - Ensure admin access for rank updates
  
  2. Security
    - Allow admins to directly update ranks
    - Maintain RLS policies
*/

-- Update rank images with correct URLs
UPDATE account_ranks
SET image_url = CASE name
  WHEN 'Bronze' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/5/5a/Bronze_Rank_Icon.png'
  WHEN 'Silver' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/6/64/Silver_Rank_Icon.png'
  WHEN 'Gold' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/9/92/Gold_Rank_Icon.png'
  WHEN 'Platinum' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/0/08/Platinum_Rank_Icon.png'
  WHEN 'Diamond' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/c/cb/Diamond_Rank_Icon.png'
  WHEN 'Emerald' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/0/06/Emerald_Rank_Icon.png'
  WHEN 'Nightmare' THEN 'https://static.wikia.nocookie.net/robloxbedwars/images/7/76/Nightmare_Rank_Icon.png'
END
WHERE name IN ('Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Emerald', 'Nightmare');

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Only admins can manage account ranks" ON player_account_ranks;

-- Create new policy for admin rank management
CREATE POLICY "Only admins can manage account ranks"
ON player_account_ranks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);