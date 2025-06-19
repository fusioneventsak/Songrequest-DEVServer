/*
  # Add ticker_active column to ui_settings

  1. Changes
    - Add ticker_active column to ui_settings table with default value false
    - This column will control whether the ticker is actively displaying custom messages

  2. Security
    - No changes to existing RLS policies needed
    - Column inherits existing table permissions
*/

-- Add ticker_active column if it doesn't exist
ALTER TABLE ui_settings ADD COLUMN IF NOT EXISTS ticker_active BOOLEAN DEFAULT false;

-- Add a comment to document the column purpose
COMMENT ON COLUMN ui_settings.ticker_active IS 'Controls whether the ticker is actively displaying custom messages';