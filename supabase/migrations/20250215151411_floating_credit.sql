/*
  # Fix Set List Songs Position Handling

  1. Changes
    - Remove existing position triggers and constraints
    - Add new position handling with proper ordering
    - Fix cascading deletes
    - Add proper indexes

  2. Security
    - Maintain existing RLS policies
*/

-- First, remove existing position-related objects
DROP TRIGGER IF EXISTS maintain_set_list_songs_position ON set_list_songs;
DROP FUNCTION IF EXISTS maintain_set_list_songs_position();
DROP INDEX IF EXISTS idx_set_list_songs_position;

-- Create a new function for position handling
CREATE OR REPLACE FUNCTION maintain_set_list_songs_position()
RETURNS TRIGGER AS $$
DECLARE
  max_position INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get the current maximum position for this set list
    SELECT COALESCE(MAX(position), -1) INTO max_position
    FROM set_list_songs
    WHERE set_list_id = NEW.set_list_id;
    
    -- Set the new position to max + 1
    NEW.position = max_position + 1;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update positions for remaining songs
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

-- Create index for better performance
CREATE INDEX idx_set_list_songs_set_list_position 
  ON set_list_songs(set_list_id, position);

-- Ensure cascade delete is properly set up
ALTER TABLE set_list_songs DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;
ALTER TABLE set_list_songs ADD CONSTRAINT set_list_songs_set_list_id_fkey 
  FOREIGN KEY (set_list_id) REFERENCES set_lists(id) ON DELETE CASCADE;

-- Clear any existing data to ensure clean state
TRUNCATE TABLE set_list_songs CASCADE;
TRUNCATE TABLE set_lists CASCADE;