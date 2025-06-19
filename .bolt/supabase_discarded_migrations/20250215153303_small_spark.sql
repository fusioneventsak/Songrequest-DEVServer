-- Clear all existing data safely
DELETE FROM set_list_songs;
DELETE FROM set_lists;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create a simple, reliable activation trigger
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other set lists in a single operation
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Add cascade delete to set_list_songs
ALTER TABLE set_list_songs DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;
ALTER TABLE set_list_songs ADD CONSTRAINT set_list_songs_set_list_id_fkey 
  FOREIGN KEY (set_list_id) REFERENCES set_lists(id) ON DELETE CASCADE;