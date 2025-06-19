/*
  # Add Frontend Color Settings

  1. Changes
    - Add new columns to ui_settings table for frontend colors:
      - frontend_header_bg (text)
      - frontend_bg_color (text)
      - frontend_accent_color (text)
      - frontend_secondary_accent (text)
    - Add color validation constraints if they don't exist
    - Set default values for new columns

  2. Notes
    - All colors must be valid hex codes (e.g., #ff00ff)
    - Default values match the existing frontend theme
    - Safe migration that checks for existing constraints
*/

-- Add new columns with default values if they don't exist
DO $$ 
BEGIN
  -- Add frontend_header_bg column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_header_bg') 
  THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN frontend_header_bg text DEFAULT '#13091f'::text;
  END IF;

  -- Add frontend_bg_color column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_bg_color') 
  THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN frontend_bg_color text DEFAULT '#0f051d'::text;
  END IF;

  -- Add frontend_accent_color column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_accent_color') 
  THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN frontend_accent_color text DEFAULT '#ff00ff'::text;
  END IF;

  -- Add frontend_secondary_accent column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_secondary_accent') 
  THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN frontend_secondary_accent text DEFAULT '#9d00ff'::text;
  END IF;
END $$;

-- Add constraints if they don't exist
DO $$ 
BEGIN
  -- Add frontend_header_bg constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'ui_settings' AND constraint_name = 'valid_frontend_header_bg') 
  THEN
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_frontend_header_bg CHECK (frontend_header_bg ~* '^#[0-9A-F]{6}$'::text);
  END IF;

  -- Add frontend_bg_color constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'ui_settings' AND constraint_name = 'valid_frontend_bg_color') 
  THEN
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_frontend_bg_color CHECK (frontend_bg_color ~* '^#[0-9A-F]{6}$'::text);
  END IF;

  -- Add frontend_accent_color constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'ui_settings' AND constraint_name = 'valid_frontend_accent_color') 
  THEN
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_frontend_accent_color CHECK (frontend_accent_color ~* '^#[0-9A-F]{6}$'::text);
  END IF;

  -- Add frontend_secondary_accent constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'ui_settings' AND constraint_name = 'valid_frontend_secondary_accent') 
  THEN
    ALTER TABLE public.ui_settings
    ADD CONSTRAINT valid_frontend_secondary_accent CHECK (frontend_secondary_accent ~* '^#[0-9A-F]{6}$'::text);
  END IF;
END $$;