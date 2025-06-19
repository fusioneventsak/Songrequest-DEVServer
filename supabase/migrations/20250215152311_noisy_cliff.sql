/*
  # Set List Activation Management

  1. Changes
    - Drop existing triggers and functions
    - Recreate trigger for set list activation with improved logic
    - Add safety checks for activation state

  2. Notes
    - Ensures clean state before creating new trigger
    - Improves activation logic with explicit state checks
*/

-- First, drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP TRIGGER IF EXISTS ensure_single_active_setlist_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation() CASCADE;
DROP FUNCTION IF EXISTS ensure_single_active_setlist() CASCADE;
DROP FUNCTION IF EXISTS toggle_set_list_active(UUID) CASCADE;

-- Create a simple but effective trigger for set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  -- If we're activating a set list, ensure all others are deactivated
  IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
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
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Add an index to optimize the active status check if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_set_lists_is_active ON set_lists(is_active)
WHERE is_active = true;