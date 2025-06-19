/*
  # Fix Settings Table RLS Policies
  
  1. Changes
    - Drop redundant SELECT policy since it's already covered by ALL policy
    - This resolves multiple permissive policies warnings for the settings table
    
  2. Security
    - Maintains the same access control, just optimizes policy execution
*/

-- Drop the redundant SELECT policy since it's covered by the ALL policy
DROP POLICY IF EXISTS "Settings SELECT policy" ON public.settings;

-- Ensure the ALL policy exists and covers all operations
DO $$
BEGIN
  -- Only create the policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'settings' 
    AND policyname = 'Settings ALL policy'
  ) THEN
    CREATE POLICY "Settings ALL policy" 
      ON public.settings
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;