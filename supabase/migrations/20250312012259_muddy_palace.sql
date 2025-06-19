-- Make sure the set_lists table has proper constraints and defaults
ALTER TABLE set_lists ALTER COLUMN name SET NOT NULL;
ALTER TABLE set_lists ALTER COLUMN date SET NOT NULL;

-- Set default values to prevent NULL violations
ALTER TABLE set_lists ALTER COLUMN name SET DEFAULT 'New Set List';
ALTER TABLE set_lists ALTER COLUMN notes SET DEFAULT '';
ALTER TABLE set_lists ALTER COLUMN is_active SET DEFAULT false;

-- Fix any existing NULL values
UPDATE set_lists 
SET name = 'Unnamed Set List' 
WHERE name IS NULL;

UPDATE set_lists 
SET notes = '' 
WHERE notes IS NULL;

UPDATE set_lists 
SET date = CURRENT_DATE 
WHERE date IS NULL;

-- Add validation trigger for set list names
CREATE OR REPLACE FUNCTION validate_set_list_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name := 'Unnamed Set List';
  END IF;
  
  IF NEW.notes IS NULL THEN
    NEW.notes := '';
  END IF;
  
  IF NEW.date IS NULL THEN
    NEW.date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_set_list_name_trigger ON set_lists;
CREATE TRIGGER validate_set_list_name_trigger
  BEFORE INSERT OR UPDATE ON set_lists
  FOR EACH ROW
  EXECUTE FUNCTION validate_set_list_name();

-- Fix the set list activation trigger to safely handle toggles
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only deactivate other set lists when activating one
  IF NEW.is_active = true AND OLD.is_active = false THEN
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Make sure all tables that reference set_lists have cascade delete
ALTER TABLE set_list_songs 
DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;

ALTER TABLE set_list_songs
ADD CONSTRAINT set_list_songs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

ALTER TABLE queue_reset_logs 
DROP CONSTRAINT IF EXISTS queue_reset_logs_set_list_id_fkey;

ALTER TABLE queue_reset_logs
ADD CONSTRAINT queue_reset_logs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Add transaction-safe statement for deletion
CREATE OR REPLACE FUNCTION delete_set_list_safely(p_set_list_id UUID)
RETURNS void AS $$
BEGIN
  -- First delete any records in queue_reset_logs to avoid FK constraints
  DELETE FROM queue_reset_logs 
  WHERE set_list_id = p_set_list_id;
  
  -- Now delete the set list (which will cascade to set_list_songs)
  DELETE FROM set_lists 
  WHERE id = p_set_list_id;
END;
$$ LANGUAGE plpgsql;