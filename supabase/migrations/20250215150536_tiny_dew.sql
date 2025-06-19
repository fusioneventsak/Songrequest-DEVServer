-- Drop any existing functions and triggers
DROP FUNCTION IF EXISTS toggle_set_list_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS ensure_single_active_setlist() CASCADE;
DROP TRIGGER IF EXISTS ensure_single_active_setlist_trigger ON set_lists;
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;

-- Create a robust trigger for set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- If we're activating a set list
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
    -- First, count how many active set lists we have
    SELECT COUNT(*) INTO active_count
    FROM set_lists
    WHERE is_active = true AND id != NEW.id;
    
    -- If we have any active set lists, deactivate them
    IF active_count > 0 THEN
      UPDATE set_lists
      SET is_active = false
      WHERE id != NEW.id
        AND is_active = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger with proper timing and conditions
CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_set_list_activation();

-- Add an index to optimize the active status check
CREATE INDEX IF NOT EXISTS idx_set_lists_is_active ON set_lists(is_active)
WHERE is_active = true;