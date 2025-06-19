-- Clear all set list data safely
DELETE FROM set_list_songs;
DELETE FROM set_lists;

-- Ensure no set lists are active
UPDATE set_lists SET is_active = false;

-- Create a simple activation trigger
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- If we're activating a set list
  IF NEW.is_active = true THEN
    -- Deactivate all other set lists
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