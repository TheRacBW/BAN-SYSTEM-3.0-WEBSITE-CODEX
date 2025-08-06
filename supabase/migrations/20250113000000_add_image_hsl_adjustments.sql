-- Add HSL adjustment columns to cards table
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_hue INTEGER DEFAULT 0;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_saturation INTEGER DEFAULT 100;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_lightness INTEGER DEFAULT 100;

-- Add comments for clarity
COMMENT ON COLUMN cards.image_hue IS 'Hue adjustment for main image (-180 to 180)';
COMMENT ON COLUMN cards.image_saturation IS 'Saturation adjustment for main image (0 to 200)';
COMMENT ON COLUMN cards.image_lightness IS 'Lightness adjustment for main image (0 to 200)'; 