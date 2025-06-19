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

-- Create the trigger with proper timing and conditions
CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Add indexes for better performance
DROP INDEX IF EXISTS idx_set_lists_is_active;
CREATE INDEX idx_set_lists_is_active ON set_lists(is_active) WHERE is_active = true;

-- Check if index exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_set_list_songs_set_list_id'
  ) THEN
    CREATE INDEX idx_set_list_songs_set_list_id ON set_list_songs(set_list_id);
  END IF;
END $$;