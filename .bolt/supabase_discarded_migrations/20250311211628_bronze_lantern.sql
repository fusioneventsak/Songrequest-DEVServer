/*
  # Fix UI Settings RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Create new policies allowing public access
    - Add proper constraints for color validation
    - Add frontend color columns
    
  2. Security
    - Enable public access for all operations
    - Maintain data integrity with constraints
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public to read UI settings" ON ui_settings;
DROP POLICY IF EXISTS "Allow authenticated to manage UI settings" ON ui_settings;
DROP POLICY IF EXISTS "Allow public read access to UI settings" ON ui_settings;
DROP POLICY IF EXISTS "Allow authenticated users to manage UI settings" ON ui_settings;

-- Enable RLS
ALTER TABLE ui_settings ENABLE ROW LEVEL SECURITY;

-- Create new, more permissive policies
CREATE POLICY "Public read access to UI settings"
  ON ui_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public update access to UI settings"
  ON ui_settings
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Add frontend color columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_header_bg') 
  THEN
    ALTER TABLE ui_settings 
    ADD COLUMN frontend_header_bg text DEFAULT '#13091f'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_bg_color') 
  THEN
    ALTER TABLE ui_settings 
    ADD COLUMN frontend_bg_color text DEFAULT '#13091f'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_accent_color') 
  THEN
    ALTER TABLE ui_settings 
    ADD COLUMN frontend_accent_color text DEFAULT '#ff00ff'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'frontend_secondary_accent') 
  THEN
    ALTER TABLE ui_settings 
    ADD COLUMN frontend_secondary_accent text DEFAULT '#9d00ff'::text;
  END IF;
END $$;

-- Add color validation constraints
ALTER TABLE ui_settings
  DROP CONSTRAINT IF EXISTS valid_frontend_header_bg,
  DROP CONSTRAINT IF EXISTS valid_frontend_bg_color,
  DROP CONSTRAINT IF EXISTS valid_frontend_accent_color,
  DROP CONSTRAINT IF EXISTS valid_frontend_secondary_accent;

ALTER TABLE ui_settings
  ADD CONSTRAINT valid_frontend_header_bg 
    CHECK (frontend_header_bg ~* '^#[0-9A-F]{6}$'::text),
  ADD CONSTRAINT valid_frontend_bg_color 
    CHECK (frontend_bg_color ~* '^#[0-9A-F]{6}$'::text),
  ADD CONSTRAINT valid_frontend_accent_color 
    CHECK (frontend_accent_color ~* '^#[0-9A-F]{6}$'::text),
  ADD CONSTRAINT valid_frontend_secondary_accent 
    CHECK (frontend_secondary_accent ~* '^#[0-9A-F]{6}$'::text);

-- Ensure we have at least one row
INSERT INTO ui_settings (
  band_name,
  primary_color,
  secondary_color,
  frontend_header_bg,
  frontend_bg_color,
  frontend_accent_color,
  frontend_secondary_accent
) VALUES (
  'uRequest Live',
  '#ff00ff',
  '#9d00ff',
  '#13091f',
  '#13091f',
  '#ff00ff',
  '#9d00ff'
) ON CONFLICT DO NOTHING;