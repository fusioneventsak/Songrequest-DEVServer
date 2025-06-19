/*
  # Add QR Code Settings to UI Settings
  
  1. Changes
    - Add show_qr_code column to ui_settings table to control QR code visibility
    - Set default value to false
    - Update existing rows
*/

DO $$ 
BEGIN
  -- Add show_qr_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'show_qr_code'
  ) THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN show_qr_code boolean DEFAULT false;
    
    -- Update existing rows
    UPDATE public.ui_settings
    SET show_qr_code = false
    WHERE show_qr_code IS NULL;
  END IF;
END $$;