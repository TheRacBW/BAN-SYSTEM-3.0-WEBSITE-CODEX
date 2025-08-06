/*
  # Add Image Positioning and Sizing to Cards
  
  1. Changes
    - Add image_position_x and image_position_y for positioning
    - Add image_width and image_height for sizing
    - Add image_rotation for rotation
    - Add image_scale for scaling
  
  2. Purpose
    - Allow admins to customize image positioning and sizing
    - Save positioning data to database
    - Maintain card frame and other elements unchanged
*/

-- Add image positioning and sizing columns to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_position_x numeric DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_position_y numeric DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_width numeric DEFAULT 144; -- 36 * 4 (w-36 = 144px)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_height numeric DEFAULT 144; -- 36 * 4 (h-36 = 144px)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_rotation numeric DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_scale numeric DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN cards.image_position_x IS 'X position offset in pixels (negative = left, positive = right)';
COMMENT ON COLUMN cards.image_position_y IS 'Y position offset in pixels (negative = up, positive = down)';
COMMENT ON COLUMN cards.image_width IS 'Image width in pixels';
COMMENT ON COLUMN cards.image_height IS 'Image height in pixels';
COMMENT ON COLUMN cards.image_rotation IS 'Image rotation in degrees';
COMMENT ON COLUMN cards.image_scale IS 'Image scale factor (1 = 100%)';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_image_position ON cards(image_position_x, image_position_y);
CREATE INDEX IF NOT EXISTS idx_cards_image_size ON cards(image_width, image_height); 