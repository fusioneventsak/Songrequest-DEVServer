/*
  # Fix RLS Policies and Constraints

  1. Changes
    - Fix RLS policies for requests table
    - Remove unique constraint on set_list_songs position
    - Add proper position handling

  2. Security
    - Update RLS policies to allow public access
*/

-- First, fix the RLS policies for requests
DROP POLICY IF EXISTS "Allow public read access to requests" ON requests;
DROP POLICY IF EXISTS "Allow authenticated users to manage requests" ON requests;
DROP POLICY IF EXISTS "Enable realtime for all users" ON requests;

-- Create new, more permissive policies for requests
CREATE POLICY "Public read access to requests"
  ON requests FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access to requests"
  ON requests FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public update access to requests"
  ON requests FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete access to requests"
  ON requests FOR DELETE
  TO public
  USING (true);

-- Fix set_list_songs position handling
DROP INDEX IF EXISTS idx_set_list_songs_position;
DROP TRIGGER IF EXISTS maintain_set_list_songs_position ON set_list_songs;
DROP FUNCTION IF EXISTS maintain_set_list_songs_position();

-- Create a new function to handle position updates
CREATE OR REPLACE FUNCTION maintain_set_list_songs_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Update positions for existing songs
  IF TG_OP = 'INSERT' THEN
    UPDATE set_list_songs
    SET position = position + 1
    WHERE set_list_id = NEW.set_list_id
    AND position >= NEW.position;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE set_list_songs
    SET position = position - 1
    WHERE set_list_id = OLD.set_list_id
    AND position > OLD.position;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger for position maintenance
CREATE TRIGGER maintain_set_list_songs_position
  BEFORE INSERT OR DELETE ON set_list_songs
  FOR EACH ROW
  EXECUTE FUNCTION maintain_set_list_songs_position();

-- Create index on set_list_id and position for better performance
CREATE INDEX idx_set_list_songs_position 
  ON set_list_songs(set_list_id, position);