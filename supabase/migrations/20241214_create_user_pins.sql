-- Create user_pins table for individual user pin system
CREATE TABLE IF NOT EXISTS user_pins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, player_id)
);

-- Add RLS policies
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pins
CREATE POLICY "Users can view their own pins" ON user_pins
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own pins
CREATE POLICY "Users can insert their own pins" ON user_pins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own pins
CREATE POLICY "Users can delete their own pins" ON user_pins
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_pins_user_id ON user_pins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pins_player_id ON user_pins(player_id); 