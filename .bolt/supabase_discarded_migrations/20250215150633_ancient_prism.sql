-- Drop any existing functions and triggers
DROP FUNCTION IF EXISTS toggle_set_list_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS ensure_single_active_setlist() CASCADE;
DROP TRIGGER IF EXISTS ensure_single_active_setlist_trigger ON set_lists;
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;

-- Create a robust trigger for set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- If we're activating a set list, ensure all others are deactivated
  IF NEW.is_active = true AND OLD.is_active = false THEN
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id
      AND is_active = true;
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