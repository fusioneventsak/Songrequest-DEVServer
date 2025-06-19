/*
  # Add song_border_color to UI Settings

  1. Changes
    - Add song_border_color column to ui_settings table
    - Add validation constraint for hexadecimal color format
    - Set default value to frontend_accent_color or #ff00ff
  
  2. Data Migration
    - Update existing rows to use frontend_accent_color if available
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