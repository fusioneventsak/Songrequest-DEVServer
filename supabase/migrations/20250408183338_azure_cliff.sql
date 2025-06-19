/*
  # Add song_border_color column to ui_settings table

  1. Changes
    - Add song_border_color column to ui_settings table
    - Set default to frontend_accent_color value or fallback to #ff00ff
    - Add color format validation check
    - Update existing rows to use frontend_accent_color value

  2. Security
    - No changes to RLS policies
*/

DO $$ 
BEGIN
  -- Add song_border_color column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'song_border_color'
  ) THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN song_border_color text DEFAULT '#ff00ff'::text;
    
    -- Add hex color validation check
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_song_border_color 
    CHECK (song_border_color ~* '^#[0-9A-F]{6}$'::text);
    
    -- Update existing rows to use frontend_accent_color if available
    UPDATE public.ui_settings
    SET song_border_color = frontend_accent_color
    WHERE frontend_accent_color IS NOT NULL;
  END IF;
END $$;