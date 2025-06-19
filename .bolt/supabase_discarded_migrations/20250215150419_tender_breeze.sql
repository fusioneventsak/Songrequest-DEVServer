-- Remove previous transaction-related functions and triggers
DROP FUNCTION IF EXISTS begin_transaction() CASCADE;
DROP FUNCTION IF EXISTS commit_transaction() CASCADE;
DROP FUNCTION IF EXISTS rollback_transaction() CASCADE;
DROP FUNCTION IF EXISTS toggle_set_list_active(UUID) CASCADE;
DROP FUNCTION IF EXISTS ensure_single_active_setlist() CASCADE;

-- Create a more reliable trigger for set list activation
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

-- Create the trigger
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
CREATE TRIGGER handle_set_list_activation_trigger
  AFTER UPDATE OF is_active ON set_lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_set_list_activation();