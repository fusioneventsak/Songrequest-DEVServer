/*
  # Add Custom Message to UI Settings

  1. Changes
    - Add customMessage column to ui_settings table
    - Set default value to empty string
    - Update existing rows
*/

DO $$ 
BEGIN
  -- Add customMessage column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'custom_message'
  ) THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN custom_message text DEFAULT ''::text;
    
    -- Update existing rows to have empty string
    UPDATE public.ui_settings
    SET custom_message = ''
    WHERE custom_message IS NULL;
  END IF;
END $$;