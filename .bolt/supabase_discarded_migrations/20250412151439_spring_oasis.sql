/*
  # Fix User Messages in Requests
  
  1. Changes
    - Ensure messages are properly stored and retrieved
    - Add realtime notification triggers
    - Fix nullable columns and add constraints
    - Add performance indexes
  
  2. Security
    - Update RLS policies to ensure consistent access
*/

-- Create the notify_realtime_changes function if it doesn't exist
CREATE OR REPLACE FUNCTION notify_realtime_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM pg_notify(
      'realtime_changes',
      json_build_object(
        'table', TG_TABLE_NAME,
        'type', TG_OP,
        'record', row_to_json(NEW)
      )::text
    );
    RETURN NEW;
  ELSE
    PERFORM pg_notify(
      'realtime_changes',
      json_build_object(
        'table', TG_TABLE_NAME,
        'type', TG_OP,
        'record', row_to_json(OLD)
      )::text
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the notify_requester_changes trigger if it doesn't exist
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requesters_request_id ON requesters(request_id);
CREATE INDEX IF NOT EXISTS idx_requesters_created_at ON requesters(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_is_played ON requests(is_played);
CREATE INDEX IF NOT EXISTS idx_requests_title_artist ON requests(title, artist);

-- Remove existing RLS policies (safely checking if they exist first)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Public full access to requesters'
  ) THEN
    DROP POLICY "Public full access to requesters" ON requesters;
  END IF;
END $$;

-- Create comprehensive RLS policy
CREATE POLICY "Public full access to requesters"
  ON requesters
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add specific policies for different operations
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
    WHERE tablename = 'requesters' AND policyname = 'Public delete access to requesters'
  ) THEN
    CREATE POLICY "Public delete access to requesters"
      ON requesters
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' AND policyname = 'Public update access to requesters'
  ) THEN
    CREATE POLICY "Public update access to requesters"
      ON requesters
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Fix data integrity - remove invalid entries
DELETE FROM requesters WHERE request_id IS NULL;
DELETE FROM requesters WHERE request_id NOT IN (SELECT id FROM requests);

-- Make sure columns are not nullable
DO $$
BEGIN
  -- Update nullable columns where needed
  UPDATE requesters SET name = 'Anonymous' WHERE name IS NULL;
  UPDATE requesters SET photo = '' WHERE photo IS NULL;
  
  -- Add NOT NULL constraints
  ALTER TABLE requesters ALTER COLUMN request_id SET NOT NULL;
  ALTER TABLE requesters ALTER COLUMN name SET NOT NULL;
  ALTER TABLE requesters ALTER COLUMN photo SET NOT NULL;
END $$;

-- Update message length constraint
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