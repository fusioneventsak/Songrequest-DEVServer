/*
  # Add Frontend Color Columns to UI Settings

  1. Changes
    - Add frontend_bg_color column to ui_settings table
    - Add frontend_accent_color column to ui_settings table
    - Set default values for new columns
    - Add color format validation checks

  2. Security
    - No changes to RLS policies needed
*/

DO $$ BEGIN
  -- Add frontend_bg_color if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_bg_color'
  ) THEN
    ALTER TABLE ui_settings 
    ADD COLUMN frontend_bg_color text DEFAULT '#13091f'::text;

    -- Add hex color validation check
    ALTER TABLE ui_settings
    ADD CONSTRAINT valid_frontend_bg_color 
    CHECK (frontend_bg_color ~* '^#[0-9A-F]{6}$'::text);
  END IF;

  -- Add frontend_accent_color if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_accent_color'
  ) THEN
    ALTER TABLE ui_settings 
    ADD COLUMN frontend_accent_color text DEFAULT '#ff00ff'::text;

    -- Add hex color validation check
    ALTER TABLE ui_settings
    ADD CONSTRAINT valid_frontend_accent_color 
    CHECK (frontend_accent_color ~* '^#[0-9A-F]{6}$'::text);
  END IF;
END $$;