/*
  # Set List Activation and Cascade Delete Setup
  
  1. Changes
    - Clear existing set list data
    - Update activation trigger logic
    - Set up cascade delete for set_list_songs
  
  2. Notes
    - Uses TRUNCATE for efficient data clearing
    - Implements single active set list constraint via trigger
    - Ensures proper cleanup of related records
*/

-- Clear all existing data safely
TRUNCATE TABLE set_list_songs CASCADE;
TRUNCATE TABLE set_lists CASCADE;

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

-- Create the trigger with proper timing and conditions
CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Add index for better performance
DROP INDEX IF EXISTS idx_set_lists_is_active;
CREATE INDEX idx_set_lists_is_active ON set_lists(is_active) WHERE is_active = true;

-- Add cascade delete to set_list_songs
ALTER TABLE set_list_songs DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;
ALTER TABLE set_list_songs ADD CONSTRAINT set_list_songs_set_list_id_fkey 
  FOREIGN KEY (set_list_id) REFERENCES set_lists(id) ON DELETE CASCADE;