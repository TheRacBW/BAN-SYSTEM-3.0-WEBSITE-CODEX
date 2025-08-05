/*
  # Create Card System Tables
  
  1. Changes
    - Create cards table for storing card data
    - Create user_inventory table for user card collections
    - Create user_coins table for coin system
    - Create pack_types table for different pack types
    - Create user_goals table for goal system
    - Create user_session_time table for time tracking
    - Add proper indexes and constraints
  
  2. Security
    - Enable RLS policies
    - Add appropriate access controls
*/

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_name text NOT NULL,
    variant_name text,
    season text NOT NULL,
    class_type text NOT NULL,
    rarity text NOT NULL CHECK (rarity IN ('Common', 'Uncommon', 'Rare', 'Epic', 'Legendary')),
    is_holo boolean DEFAULT false,
    holo_type text DEFAULT 'basic',
    card_type text NOT NULL DEFAULT 'Kit' CHECK (card_type IN ('Kit', 'Skin')),
    pack_type text NOT NULL,
    image_url text,
    background_color text DEFAULT '#5b3434',
    background_image_url text,
    ability_name text,
    ability_description text,
    flavor_text text,
    hp integer DEFAULT 100,
    weakness text,
    resistance text DEFAULT 'None',
    retreat_cost integer DEFAULT 2,
    unlock_requirement text,
    show_season_overlay boolean DEFAULT true,
    has_border boolean DEFAULT false,
    border_color text DEFAULT '#FFD700',
    border_behind_holo boolean DEFAULT true,
    has_holo_mask boolean DEFAULT false,
    holo_mask_url text,
    card_frame_color text DEFAULT '#ffffff',
    text_theme text DEFAULT 'dark' CHECK (text_theme IN ('dark', 'light')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create pack_types table
CREATE TABLE IF NOT EXISTS pack_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    price integer NOT NULL DEFAULT 100,
    card_count integer NOT NULL DEFAULT 5,
    rarity_weights jsonb NOT NULL DEFAULT '{"Common": 55, "Uncommon": 25, "Rare": 12, "Epic": 6, "Legendary": 1.5}',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Create user_coins table
CREATE TABLE IF NOT EXISTS user_coins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coins integer NOT NULL DEFAULT 0,
    total_earned integer NOT NULL DEFAULT 0,
    last_updated timestamp with time zone DEFAULT now(),
    UNIQUE(user_id)
);

-- Create user_inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quantity integer NOT NULL DEFAULT 1,
    is_equipped boolean DEFAULT false,
    obtained_at timestamp with time zone DEFAULT now(),
    obtained_from text DEFAULT 'pack',
    UNIQUE(user_id, card_id)
);

-- Create user_goals table
CREATE TABLE IF NOT EXISTS user_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type text NOT NULL CHECK (goal_type IN ('daily_time', 'weekly_time', 'cards_collected', 'packs_opened', 'coins_earned')),
    target_value integer NOT NULL,
    current_value integer NOT NULL DEFAULT 0,
    reward_coins integer NOT NULL DEFAULT 0,
    is_completed boolean DEFAULT false,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);

-- Create user_session_time table
CREATE TABLE IF NOT EXISTS user_session_time (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_start timestamp with time zone NOT NULL,
    session_end timestamp with time zone,
    duration_seconds integer,
    coins_earned integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Create pack_opening_history table
CREATE TABLE IF NOT EXISTS pack_opening_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pack_type_id uuid NOT NULL REFERENCES pack_types(id),
    cards_obtained jsonb NOT NULL,
    coins_spent integer NOT NULL,
    opened_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
CREATE INDEX IF NOT EXISTS idx_cards_pack_type ON cards(pack_type);
CREATE INDEX IF NOT EXISTS idx_cards_season ON cards(season);
CREATE INDEX IF NOT EXISTS idx_cards_class_type ON cards(class_type);

CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_card_id ON user_inventory(card_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_equipped ON user_inventory(is_equipped);

CREATE INDEX IF NOT EXISTS idx_user_coins_user_id ON user_coins(user_id);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_type ON user_goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_user_goals_completed ON user_goals(is_completed);

CREATE INDEX IF NOT EXISTS idx_user_session_time_user_id ON user_session_time(user_id);
CREATE INDEX IF NOT EXISTS idx_user_session_time_session_start ON user_session_time(session_start);

CREATE INDEX IF NOT EXISTS idx_pack_opening_history_user_id ON pack_opening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_pack_opening_history_opened_at ON pack_opening_history(opened_at);

-- Enable RLS
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_session_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_opening_history ENABLE ROW LEVEL SECURITY;

-- Cards policies (readable by all, admin only for write)
CREATE POLICY "Anyone can read cards" ON cards FOR SELECT USING (true);
CREATE POLICY "Admins can insert cards" ON cards FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update cards" ON cards FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can delete cards" ON cards FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Pack types policies (readable by all, admin only for write)
CREATE POLICY "Anyone can read pack types" ON pack_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage pack types" ON pack_types FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- User coins policies (users can only access their own data)
CREATE POLICY "Users can read own coins" ON user_coins FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own coins" ON user_coins FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own coins" ON user_coins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User inventory policies (users can only access their own data)
CREATE POLICY "Users can read own inventory" ON user_inventory FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own inventory" ON user_inventory FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own inventory" ON user_inventory FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own inventory" ON user_inventory FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- User goals policies (users can only access their own data)
CREATE POLICY "Users can read own goals" ON user_goals FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can update own goals" ON user_goals FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own goals" ON user_goals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User session time policies (users can only access their own data)
CREATE POLICY "Users can read own session time" ON user_session_time FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own session time" ON user_session_time FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own session time" ON user_session_time FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Pack opening history policies (users can only access their own data)
CREATE POLICY "Users can read own pack history" ON pack_opening_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert own pack history" ON pack_opening_history FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Insert default pack types
INSERT INTO pack_types (name, description, price, card_count, rarity_weights) VALUES
('Season Pack', 'Basic season pack with common cards', 100, 5, '{"Common": 60, "Uncommon": 25, "Rare": 12, "Epic": 2.5, "Legendary": 0.5}'),
('Robux Pack', 'Premium pack with better odds', 250, 5, '{"Common": 45, "Uncommon": 30, "Rare": 15, "Epic": 8, "Legendary": 2}'),
('Event Pack', 'Special event pack with unique cards', 150, 5, '{"Common": 50, "Uncommon": 28, "Rare": 15, "Epic": 5, "Legendary": 2}'),
('Whisper Pack', 'Whisper-themed pack', 200, 5, '{"Common": 40, "Uncommon": 35, "Rare": 18, "Epic": 5, "Legendary": 2}'),
('Nightmare Pack', 'Dark-themed pack', 300, 5, '{"Common": 35, "Uncommon": 35, "Rare": 20, "Epic": 8, "Legendary": 2}'),
('Free Kit Pack', 'Free pack with basic cards', 0, 3, '{"Common": 70, "Uncommon": 25, "Rare": 5, "Epic": 0, "Legendary": 0}');

-- Add comments for documentation
COMMENT ON TABLE cards IS 'Stores all card data for the card collection system';
COMMENT ON TABLE pack_types IS 'Defines different types of card packs available for purchase';
COMMENT ON TABLE user_coins IS 'Tracks user coin balance and earnings';
COMMENT ON TABLE user_inventory IS 'Stores user card collections and equipped cards';
COMMENT ON TABLE user_goals IS 'Tracks user goals and achievements for coin rewards';
COMMENT ON TABLE user_session_time IS 'Tracks user time spent on website for coin rewards';
COMMENT ON TABLE pack_opening_history IS 'Tracks pack opening history for analytics'; 