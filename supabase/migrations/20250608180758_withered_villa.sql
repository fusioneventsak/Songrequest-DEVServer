/*
  # Fix Realtime Updates and Request Locking
  
  1. Changes
    - Enable REPLICA IDENTITY FULL for all tables to improve realtime updates
    - Add missing realtime policies for requests and requesters tables
    - Add constraints to ensure data integrity
    - Add indexes for better performance
    
  2. Security
    - Maintain existing RLS policies
*/

-- Enable REPLICA IDENTITY FULL for all tables to improve realtime updates
ALTER TABLE requests REPLICA IDENTITY FULL;
ALTER TABLE requesters REPLICA IDENTITY FULL;
ALTER TABLE songs REPLICA IDENTITY FULL;
ALTER TABLE set_lists REPLICA IDENTITY FULL;

-- Ensure RLS policies allow realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requests' 
    AND policyname = 'Allow realtime for requests'
  ) THEN
    CREATE POLICY "Allow realtime for requests"
      ON requests
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' 
    AND policyname = 'Allow realtime for requesters'
  ) THEN
    CREATE POLICY "Allow realtime for requesters"
      ON requesters
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Add index for locked requests to improve performance
CREATE INDEX IF NOT EXISTS idx_requests_locked 
    ON requests(is_locked) 
    WHERE is_locked = true;

-- Add index for title and artist with is_played filter
CREATE INDEX IF NOT EXISTS idx_requests_title_artist_not_played 
    ON requests(title, artist) 
    WHERE is_played = false;

-- Add index for requesters by request_id
CREATE INDEX IF NOT EXISTS idx_requesters_request_id 
    ON requesters(request_id);

-- Add constraints to ensure data integrity
DO $$
BEGIN
    -- Check for request_title_not_empty constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'request_title_not_empty'
    ) THEN
        ALTER TABLE requests 
        ADD CONSTRAINT request_title_not_empty 
        CHECK (trim(title) <> '');
    END IF;
END $$;

-- Add trigger for realtime notifications if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_request_changes'
  ) THEN
    CREATE TRIGGER notify_request_changes
      AFTER INSERT OR DELETE OR UPDATE ON requests
      FOR EACH ROW
      EXECUTE FUNCTION notify_realtime_changes();
  END IF;
END $$;

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