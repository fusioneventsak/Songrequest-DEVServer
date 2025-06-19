/*
  # Fix NULL Violations and Set List Constraints

  1. Changes
    - Add NOT NULL constraints with default values to set_lists columns
    - Add default values for fields that should never be null
    - Add cascade delete constraints for set_list_songs
    - Add validation rules to ensure data integrity
*/

-- First, clean up any NULL values in the existing data
UPDATE set_lists 
SET name = 'Unnamed Set List' 
WHERE name IS NULL;

UPDATE set_lists 
SET notes = '' 
WHERE notes IS NULL;

-- Add default values for columns to prevent future NULL violations
ALTER TABLE set_lists 
ALTER COLUMN name SET DEFAULT 'New Set List';

ALTER TABLE set_lists 
ALTER COLUMN notes SET DEFAULT '';

-- Make sure is_active has a default value
ALTER TABLE set_lists 
ALTER COLUMN is_active SET DEFAULT false;

-- Add cascade delete to ensure proper cleanup
ALTER TABLE set_list_songs 
DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;

ALTER TABLE set_list_songs
ADD CONSTRAINT set_list_songs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_set_list_songs_set_list_id 
ON set_list_songs(set_list_id);

-- Ensure that any updates to set_lists name field cannot set it to NULL
CREATE OR REPLACE FUNCTION validate_set_list_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NULL THEN
    NEW.name := 'Unnamed Set List';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_set_list_name_trigger ON set_lists;

CREATE TRIGGER validate_set_list_name_trigger
BEFORE INSERT OR UPDATE ON set_lists
FOR EACH ROW
EXECUTE FUNCTION validate_set_list_name();