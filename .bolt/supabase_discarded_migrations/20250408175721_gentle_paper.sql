/*
  # Add song border color to UI settings table
  
  1. Changes
    - Add song_border_color column to ui_settings table
    - Set default value to match frontend accent color
    - Add color validation check
    
  2. Security
    - No changes to RLS policies needed
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
    
    -- Add color validation constraint 
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_song_border_color 
    CHECK (song_border_color ~* '^#[0-9A-F]{6}$'::text);
  END IF;
END $$;