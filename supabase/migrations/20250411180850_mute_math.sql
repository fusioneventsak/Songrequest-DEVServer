/*
  # Add Navigation Color Settings

  1. Changes
    - Add nav_bg_color column for profile and bottom nav background
    - Add highlight_color column for nav items, user profile, and setting text
    - Set default values to match existing theme
    - Add color validation checks
  
  2. Security
    - No changes to RLS policies needed
*/

DO $$ 
BEGIN
  -- Add nav_bg_color column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'nav_bg_color'
  ) THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN nav_bg_color text DEFAULT '#0f051d'::text;
    
    -- Add hex color validation check
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_nav_bg_color 
    CHECK (nav_bg_color ~* '^#[0-9A-F]{6}$'::text);
  END IF;

  -- Add highlight_color column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'highlight_color'
  ) THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN highlight_color text DEFAULT '#ff00ff'::text;
    
    -- Add hex color validation check
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_highlight_color 
    CHECK (highlight_color ~* '^#[0-9A-F]{6}$'::text);
    
    -- Update existing rows to use frontend_accent_color if available
    UPDATE public.ui_settings
    SET highlight_color = frontend_accent_color
    WHERE frontend_accent_color IS NOT NULL;
  END IF;
END $$;