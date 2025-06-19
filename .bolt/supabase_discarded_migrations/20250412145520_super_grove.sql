/*
  # Fix issues with requester visibility in requests
  
  1. Changes
    - Add better indexes for request and requester relationships
    - Add additional policies for ensuring requester access
    - Add NOT NULL constraints to essential fields
    
  2. Security
    - Ensure all data is properly accessible
*/

-- First, check if there are any malformed entries in the requesters table
DO $$ 
BEGIN
  RAISE NOTICE 'Checking for requesters with null request_id...';
  
  -- Clean up any requesters with NULL request_id if they exist
  DELETE FROM requesters WHERE request_id IS NULL;
  
  -- Check for requesters with invalid request_id
  DELETE FROM requesters 
  WHERE request_id IS NOT NULL 
    AND request_id NOT IN (SELECT id FROM requests);
END $$;

-- Add indexes for better join performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_requesters_request_id'
  ) THEN
    CREATE INDEX idx_requesters_request_id ON requesters(request_id);
  END IF;
END $$;

-- Safely handle RLS policies - drop only if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Public full access to requesters'
  ) THEN
    DROP POLICY "Public full access to requesters" ON requesters;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Allow authenticated users to manage requesters'
  ) THEN
    DROP POLICY "Allow authenticated users to manage requesters" ON requesters;
  END IF;
END $$;

-- Create clear, specific policies for requesters
CREATE POLICY "Public full access to requesters"
  ON requesters
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add extra granular policies to be extra sure, but check if they exist first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Public insert access to requesters'
  ) THEN
    CREATE POLICY "Public insert access to requesters"
      ON requesters
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Public read access to requesters'
  ) THEN
    CREATE POLICY "Public read access to requesters"  
      ON requesters
      FOR SELECT
      TO public  
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Enable realtime for all users'
  ) THEN
    CREATE POLICY "Enable realtime for all users"
      ON requesters
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Additional helpful indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_requesters_created_at'
  ) THEN
    CREATE INDEX idx_requesters_created_at ON requesters(created_at);
  END IF;
END $$;

-- Make sure request_id is not nullable
DO $$
BEGIN
  -- Only apply NOT NULL constraint if column allows NULL values currently
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requesters' 
    AND column_name = 'request_id'
    AND is_nullable = 'YES'
  ) THEN
    -- First, ensure there are no NULL values
    DELETE FROM requesters WHERE request_id IS NULL;
    -- Then set NOT NULL constraint
    ALTER TABLE requesters ALTER COLUMN request_id SET NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requesters' 
    AND column_name = 'name'
    AND is_nullable = 'YES'
  ) THEN
    -- First ensure no NULL values
    UPDATE requesters SET name = 'Anonymous' WHERE name IS NULL;
    -- Then set NOT NULL constraint
    ALTER TABLE requesters ALTER COLUMN name SET NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requesters' 
    AND column_name = 'photo'
    AND is_nullable = 'YES'
  ) THEN
    -- First ensure no NULL values
    UPDATE requesters SET photo = '' WHERE photo IS NULL;
    -- Then set NOT NULL constraint
    ALTER TABLE requesters ALTER COLUMN photo SET NOT NULL;
  END IF;
END $$;

-- Update message constraint if needed
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

-- Add trigger for realtime notifications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_requester_changes'
  ) THEN
    CREATE TRIGGER notify_requester_changes
      AFTER INSERT OR DELETE OR UPDATE ON requesters
      FOR EACH ROW
      EXECUTE FUNCTION notify_realtime_changes();
  END IF;
END $$;