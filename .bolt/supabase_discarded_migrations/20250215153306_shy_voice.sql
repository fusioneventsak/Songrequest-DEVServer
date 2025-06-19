-- First, remove all position-related objects
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
DELETE FROM set_list_songs;
DELETE FROM set_lists;

-- Create a function to handle position updates
CREATE OR REPLACE FUNCTION update_set_list_song_positions(p_set_list_id UUID)
RETURNS void AS $$
DECLARE
  r RECORD;
  pos INTEGER := 0;
BEGIN
  FOR r IN (
    SELECT id 
    FROM set_list_songs 
    WHERE set_list_id = p_set_list_id 
    ORDER BY position
  ) LOOP
    UPDATE set_list_songs 
    SET position = pos 
    WHERE id = r.id;
    pos := pos + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;