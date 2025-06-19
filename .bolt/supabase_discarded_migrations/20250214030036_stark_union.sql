/*
  # Add realtime sync support

  1. Changes
    - Add trigger for set list changes
    - Add trigger for request changes
    - Add function to notify clients of changes

  2. Security
    - Ensure RLS policies allow realtime updates
*/

-- Function to broadcast changes
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

-- Add trigger for set_lists table
DROP TRIGGER IF EXISTS notify_set_list_changes ON set_lists;
CREATE TRIGGER notify_set_list_changes
  AFTER INSERT OR UPDATE OR DELETE ON set_lists
  FOR EACH ROW
  EXECUTE FUNCTION notify_realtime_changes();

-- Add trigger for set_list_songs table
DROP TRIGGER IF EXISTS notify_set_list_songs_changes ON set_list_songs;
CREATE TRIGGER notify_set_list_songs_changes
  AFTER INSERT OR UPDATE OR DELETE ON set_list_songs
  FOR EACH ROW
  EXECUTE FUNCTION notify_realtime_changes();

-- Add trigger for requests table
DROP TRIGGER IF EXISTS notify_request_changes ON requests;
CREATE TRIGGER notify_request_changes
  AFTER INSERT OR UPDATE OR DELETE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_realtime_changes();

-- Add trigger for requesters table
DROP TRIGGER IF EXISTS notify_requester_changes ON requesters;
CREATE TRIGGER notify_requester_changes
  AFTER INSERT OR UPDATE OR DELETE ON requesters
  FOR EACH ROW
  EXECUTE FUNCTION notify_realtime_changes();

-- Update RLS policies to ensure realtime updates work
ALTER POLICY "Anyone can read songs" ON songs RENAME TO "Public read access to songs";
ALTER POLICY "Anyone can insert songs" ON songs RENAME TO "Public insert access to songs";
ALTER POLICY "Anyone can update songs" ON songs RENAME TO "Public update access to songs";
ALTER POLICY "Anyone can delete songs" ON songs RENAME TO "Public delete access to songs";

-- Add policies for realtime subscriptions
CREATE POLICY "Enable realtime for all users"
  ON songs
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Enable realtime for all users"
  ON set_lists
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Enable realtime for all users"
  ON set_list_songs
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Enable realtime for all users"
  ON requests
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Enable realtime for all users"
  ON requesters
  FOR SELECT TO public
  USING (true);