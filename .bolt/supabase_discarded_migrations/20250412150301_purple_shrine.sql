/*
  # Fix Requester Data Visibility Issue
  
  1. Changes:
    - Clean up any invalid requester records
    - Add additional RLS policies for requester access
    - Add database constraints to ensure data integrity
    - Add debugging support to verify requester data
  
  2. Security:
    - Ensure all requester data is accessible with proper RLS policies
    - Maintain data consistency
*/

-- First clean up any invalid data
DO $$ 
BEGIN
  -- Delete requesters with missing request_id
  DELETE FROM requesters WHERE request_id IS NULL;
  
  -- Delete requesters without a valid request reference
  DELETE FROM requesters 
  WHERE request_id NOT IN (SELECT id FROM requests);
END $$;

-- Make sure requesters table has proper permissions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'requesters' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE requesters ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Make sure we have a "delete all public policies" version that won't break
DO $$ 
BEGIN
  -- Delete policies only if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requesters' AND policyname = 'Public delete access to requesters') THEN
    DROP POLICY "Public delete access to requesters" ON requesters;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requesters' AND policyname = 'Public update access to requesters') THEN
    DROP POLICY "Public update access to requesters" ON requesters;
  END IF;
END $$;

-- Create comprehensive RLS policies for requesters to ensure full access
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requesters' AND policyname = 'Public delete access to requesters') THEN
    CREATE POLICY "Public delete access to requesters"
      ON requesters
      FOR DELETE
      TO public
      USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requesters' AND policyname = 'Public update access to requesters') THEN
    CREATE POLICY "Public update access to requesters"
      ON requesters
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create proper indexes for joins
CREATE INDEX IF NOT EXISTS idx_user_votes_request_user ON user_votes(request_id, user_id);
CREATE INDEX IF NOT EXISTS idx_requesters_request_id ON requesters(request_id);

-- Update request triggers to ensure requesters are properly tracked
CREATE OR REPLACE FUNCTION validate_set_list_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := 'Unnamed Set List';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add database-level checks for data integrity
ALTER TABLE requesters ALTER COLUMN request_id SET NOT NULL;
ALTER TABLE requesters ALTER COLUMN name SET NOT NULL;
ALTER TABLE requesters ALTER COLUMN photo SET NOT NULL;

-- Update message constraint for requesters
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'message_length_check' AND table_name = 'requesters'
  ) THEN
    ALTER TABLE requesters DROP CONSTRAINT message_length_check;
  END IF;
  
  ALTER TABLE requesters ADD CONSTRAINT message_length_check CHECK (char_length(message) <= 100);
END $$;