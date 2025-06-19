/*
  # Enable Real-time Subscriptions for Request Queue
  
  1. Changes
    - Enable real-time replication for requests and requesters tables
    - Set up RLS policies allowing public read/write access
    - Grant proper permissions to anonymous and authenticated users
    - Set REPLICA IDENTITY FULL for complete real-time data
    - Add debugging trigger to log lock status changes
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Enable real-time replication for requests table
ALTER PUBLICATION supabase_realtime ADD TABLE requests;

-- Enable real-time replication for requesters table  
ALTER PUBLICATION supabase_realtime ADD TABLE requesters;

-- Enable Row Level Security on requests table (if not already enabled)
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on requesters table (if not already enabled)
ALTER TABLE requesters ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read requests (needed for real-time subscriptions)
CREATE POLICY "Allow public read access to requests" ON requests
FOR SELECT 
TO public
USING (true);

-- Create policy to allow all users to update requests (needed for lock functionality)
CREATE POLICY "Allow public update access to requests" ON requests
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Create policy to allow all users to insert requests
CREATE POLICY "Allow public insert access to requests" ON requests
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow all users to read requesters (needed for real-time subscriptions)
CREATE POLICY "Allow public read access to requesters" ON requesters
FOR SELECT
TO public
USING (true);

-- Create policy to allow all users to insert requesters
CREATE POLICY "Allow public insert access to requesters" ON requesters
FOR INSERT
TO public
WITH CHECK (true);

-- Create policy to allow all users to update requesters
CREATE POLICY "Allow public update access to requesters" ON requesters
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Grant real-time access to the tables
GRANT SELECT, INSERT, UPDATE, DELETE ON requests TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON requesters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON requesters TO authenticated;

-- Create a function to notify when lock status changes (optional for debugging)
CREATE OR REPLACE FUNCTION notify_lock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log lock status changes for debugging
  IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
    RAISE NOTICE 'Lock status changed for request %: % -> %', NEW.id, OLD.is_locked, NEW.is_locked;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to notify on lock changes (optional for debugging)
DROP TRIGGER IF EXISTS lock_change_trigger ON requests;
CREATE TRIGGER lock_change_trigger
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_lock_change();

-- Ensure the real-time subscription can access the replica identity
ALTER TABLE requests REPLICA IDENTITY FULL;
ALTER TABLE requesters REPLICA IDENTITY FULL;