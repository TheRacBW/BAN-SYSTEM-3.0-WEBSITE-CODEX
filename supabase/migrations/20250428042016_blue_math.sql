/*
  # Add Strategy Discussions System
  
  1. New Tables
    - `strategy_comments`
      - `id` (uuid, primary key)
      - `strategy_id` (text, references strategies)
      - `user_id` (uuid, references users)
      - `content` (text)
      - `created_at` (timestamp)
      - `likes` (integer)
    
    - `comment_likes`
      - `comment_id` (uuid, references strategy_comments)
      - `user_id` (uuid, references users)
      - `created_at` (timestamp)
      - Primary key is (comment_id, user_id)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create strategy_comments table
CREATE TABLE strategy_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id text REFERENCES strategies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  likes integer DEFAULT 0
);

-- Create comment_likes table
CREATE TABLE comment_likes (
  comment_id uuid REFERENCES strategy_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

-- Enable RLS
ALTER TABLE strategy_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies for strategy_comments
CREATE POLICY "Anyone can read comments"
  ON strategy_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON strategy_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON strategy_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for comment_likes
CREATE POLICY "Anyone can read likes"
  ON comment_likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like comments"
  ON comment_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike comments"
  ON comment_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to update comment likes count
CREATE OR REPLACE FUNCTION update_comment_likes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE strategy_comments
    SET likes = likes + 1
    WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE strategy_comments
    SET likes = likes - 1
    WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for likes
CREATE TRIGGER update_comment_likes_trigger
  AFTER INSERT OR DELETE ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_likes();

-- Create indexes
CREATE INDEX idx_strategy_comments_strategy_id ON strategy_comments(strategy_id);
CREATE INDEX idx_strategy_comments_user_id ON strategy_comments(user_id);
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON comment_likes(user_id);