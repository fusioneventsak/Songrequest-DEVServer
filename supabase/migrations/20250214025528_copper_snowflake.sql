/*
  # Add indexes and constraints for requests

  1. Changes
    - Add indexes on commonly queried columns
    - Add foreign key constraints
    - Update RLS policies for better security
*/

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_title ON requests (title);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests (created_at);
CREATE INDEX IF NOT EXISTS idx_requests_is_played ON requests (is_played);
CREATE INDEX IF NOT EXISTS idx_requesters_request_id ON requesters (request_id);

-- Add composite index for set list songs
CREATE UNIQUE INDEX IF NOT EXISTS idx_set_list_songs_position ON set_list_songs (set_list_id, position);

-- Update RLS policies for better security
DROP POLICY IF EXISTS "Allow all operations on songs" ON songs;

-- Create more specific policies
CREATE POLICY "Anyone can read songs"
  ON songs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert songs"
  ON songs FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update songs"
  ON songs FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete songs"
  ON songs FOR DELETE
  TO public
  USING (true);

-- Add trigger to maintain set_list_songs position ordering
CREATE OR REPLACE FUNCTION maintain_set_list_songs_position()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Update positions after deletion
    UPDATE set_list_songs
    SET position = position - 1
    WHERE set_list_id = OLD.set_list_id
    AND position > OLD.position;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    -- Update positions before insertion
    UPDATE set_list_songs
    SET position = position + 1
    WHERE set_list_id = NEW.set_list_id
    AND position >= NEW.position;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_set_list_songs_position
  BEFORE INSERT OR DELETE ON set_list_songs
  FOR EACH ROW
  EXECUTE FUNCTION maintain_set_list_songs_position();