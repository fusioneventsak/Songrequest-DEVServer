/*
  # Add Frontend Color Settings

  1. Changes
    - Add frontend color columns to ui_settings table if they don't exist
    - Drop existing constraints if they exist
    - Add color validation constraints
    - Set default values for new columns

  2. Validation
    - All colors must be valid hex codes
*/

-- Add new columns with default values if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ui_settings' AND column_name = 'frontend_bg_color') THEN
    ALTER TABLE ui_settings ADD COLUMN frontend_bg_color text DEFAULT '#13091f'::text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ui_settings' AND column_name = 'frontend_accent_color') THEN
    ALTER TABLE ui_settings ADD COLUMN frontend_accent_color text DEFAULT '#ff00ff'::text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ui_settings' AND column_name = 'frontend_header_bg') THEN
    ALTER TABLE ui_settings ADD COLUMN frontend_header_bg text DEFAULT '#13091f'::text;
  END IF;
END $$;

-- Drop existing constraints if they exist
DO $$ 
BEGIN
  ALTER TABLE ui_settings DROP CONSTRAINT IF EXISTS valid_frontend_bg_color;
  ALTER TABLE ui_settings DROP CONSTRAINT IF EXISTS valid_frontend_accent_color;
  ALTER TABLE ui_settings DROP CONSTRAINT IF EXISTS valid_frontend_header_bg;
END $$;

-- Add color validation constraints
ALTER TABLE ui_settings
ADD CONSTRAINT valid_frontend_bg_color 
  CHECK (frontend_bg_color ~* '^#[0-9A-F]{6}$'::text),
ADD CONSTRAINT valid_frontend_accent_color 
  CHECK (frontend_accent_color ~* '^#[0-9A-F]{6}$'::text),
ADD CONSTRAINT valid_frontend_header_bg 
  CHECK (frontend_header_bg ~* '^#[0-9A-F]{6}$'::text);