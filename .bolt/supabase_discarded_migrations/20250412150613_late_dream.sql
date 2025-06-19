/*
  # Add Expanded State to UI Settings
  
  1. Changes
    - Add default_expanded_requesters column to ui_settings table
    - Add default value (false)
    - Update existing rows
  
  2. Data
    - Setting allows admin to configure whether requesters are expanded by default
*/

DO $$ 
BEGIN
  -- Add default_expanded_requesters column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ui_settings' AND column_name = 'default_expanded_requesters'
  ) THEN
    ALTER TABLE public.ui_settings 
    ADD COLUMN default_expanded_requesters boolean DEFAULT false;
    
    -- Update existing rows
    UPDATE public.ui_settings
    SET default_expanded_requesters = false
    WHERE default_expanded_requesters IS NULL;
  END IF;
END $$;