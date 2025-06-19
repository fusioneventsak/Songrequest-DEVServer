-- Drop previously created transaction functions as they're not needed
DROP FUNCTION IF EXISTS begin_transaction();
DROP FUNCTION IF EXISTS commit_transaction();
DROP FUNCTION IF EXISTS rollback_transaction();

-- Improve the trigger to handle set list activation atomically
CREATE OR REPLACE FUNCTION ensure_single_active_setlist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other set lists in a single operation
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger with proper timing
DROP TRIGGER IF EXISTS ensure_single_active_setlist_trigger ON set_lists;
CREATE TRIGGER ensure_single_active_setlist_trigger
  BEFORE UPDATE ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active = true AND OLD.is_active = false)
  EXECUTE FUNCTION ensure_single_active_setlist();