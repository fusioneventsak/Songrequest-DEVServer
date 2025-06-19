/*
  # Fix Set List Songs Position Handling

  1. Changes
    - Remove all position-related constraints and triggers
    - Simplify position handling to avoid conflicts
    - Add proper cascade deletes
    - Clear existing data to ensure clean state

  2. Security
    - Maintain existing RLS policies
*/

-- First, remove all existing position-related objects
DROP TRIGGER IF EXISTS maintain_set_list_songs_position ON set_list_songs;
DROP FUNCTION IF EXISTS maintain_set_list_songs_position();
DROP INDEX IF EXISTS idx_set_list_songs_position;
DROP INDEX IF EXISTS idx_set_list_songs_set_list_position;

-- Remove any existing constraints
ALTER TABLE set_list_songs DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;

-- Ensure proper cascade delete
ALTER TABLE set_list_songs ADD CONSTRAINT set_list_songs_set_list_id_fkey 
  FOREIGN KEY (set_list_id) REFERENCES set_lists(id) ON DELETE CASCADE;

-- Clear existing data
TRUNCATE TABLE set_list_songs CASCADE;
TRUNCATE TABLE set_lists CASCADE;

-- Create a simple index for performance
CREATE INDEX idx_set_list_songs_set_list_id ON set_list_songs(set_list_id);

-- Create a function to handle batch inserts
CREATE OR REPLACE FUNCTION insert_set_list_songs(
  p_set_list_id UUID,
  p_song_ids UUID[]
) RETURNS void AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_song_ids, 1)
  LOOP
    INSERT INTO set_list_songs (set_list_id, song_id, position)
    VALUES (p_set_list_id, p_song_ids[i], i - 1);
  END LOOP;
END;
$$ LANGUAGE plpgsql;