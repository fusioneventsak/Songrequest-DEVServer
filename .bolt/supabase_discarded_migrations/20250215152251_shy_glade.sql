/*
  # Set List Activation Management

  1. Changes
    - Add trigger to ensure only one set list can be active at a time
    - Add index to optimize active status checks

  2. Security
    - No changes to RLS policies
*/

-- Add a trigger to ensure only one set list can be active at a time
CREATE OR REPLACE FUNCTION ensure_single_active_setlist()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other set lists
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_active_setlist_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_setlist();

-- Add an index to optimize the active status check
CREATE INDEX IF NOT EXISTS idx_set_lists_is_active ON set_lists(is_active)
WHERE is_active = true;