-- YouTube Audio Integration for Admin Call System
-- Adds support for YouTube video audio as admin call chimes

-- Add YouTube audio columns to admin_preferences table
DO $$
BEGIN
  -- Add youtube_audio_enabled column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_preferences' AND column_name = 'youtube_audio_enabled') THEN
    ALTER TABLE public.admin_preferences ADD COLUMN youtube_audio_enabled boolean DEFAULT false;
  END IF;
  
  -- Add youtube_video_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_preferences' AND column_name = 'youtube_video_url') THEN
    ALTER TABLE public.admin_preferences ADD COLUMN youtube_video_url text;
  END IF;
  
  -- Add youtube_audio_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_preferences' AND column_name = 'youtube_audio_url') THEN
    ALTER TABLE public.admin_preferences ADD COLUMN youtube_audio_url text;
  END IF;
  
  -- Add youtube_audio_duration column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'admin_preferences' AND column_name = 'youtube_audio_duration') THEN
    ALTER TABLE public.admin_preferences ADD COLUMN youtube_audio_duration integer DEFAULT 3;
  END IF;
END $$;

-- Update the sound_type check constraint to include 'youtube'
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.check_constraints 
             WHERE constraint_name = 'admin_preferences_sound_type_check') THEN
    ALTER TABLE public.admin_preferences DROP CONSTRAINT admin_preferences_sound_type_check;
  END IF;
  
  -- Add the new constraint with youtube option
  ALTER TABLE public.admin_preferences ADD CONSTRAINT admin_preferences_sound_type_check 
    CHECK (sound_type = ANY (ARRAY['default'::text, 'siren'::text, 'chime'::text, 'bell'::text, 'youtube'::text]));
END $$;

-- Function to validate YouTube URL format
CREATE OR REPLACE FUNCTION validate_youtube_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Check if URL matches YouTube format
  RETURN url ~ '^https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)[a-zA-Z0-9_-]{11}';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update YouTube audio settings
CREATE OR REPLACE FUNCTION update_youtube_audio_settings(
  p_user_id uuid,
  p_youtube_audio_enabled boolean,
  p_youtube_video_url text,
  p_youtube_audio_duration integer DEFAULT 3
)
RETURNS boolean AS $$
BEGIN
  -- Validate YouTube URL if provided
  IF p_youtube_video_url IS NOT NULL AND p_youtube_video_url != '' THEN
    IF NOT validate_youtube_url(p_youtube_video_url) THEN
      RAISE EXCEPTION 'Invalid YouTube URL format';
    END IF;
  END IF;
  
  -- Update preferences
  UPDATE public.admin_preferences 
  SET youtube_audio_enabled = p_youtube_audio_enabled,
      youtube_video_url = p_youtube_video_url,
      youtube_audio_duration = GREATEST(1, LEAST(10, p_youtube_audio_duration)), -- Limit 1-10 seconds
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 