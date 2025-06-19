/*
  # Fix Set List Activation and Queue Reset

  1. Changes
    - Add trigger to handle set list activation
    - Add function to reset request queue on activation
    - Add indexes for better performance
*/

-- Create function to handle set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
DECLARE
    cleared_count integer;
BEGIN
    -- If activating a set list
    IF NEW.is_active = true AND OLD.is_active = false THEN
        -- Get count of requests to be cleared
        SELECT COUNT(*) INTO cleared_count
        FROM requests
        WHERE NOT is_played;

        -- Clear all pending requests
        UPDATE requests
        SET is_played = true,
            is_locked = false
        WHERE NOT is_played;

        -- Log the reset
        INSERT INTO queue_reset_logs (set_list_id, reset_type, requests_cleared)
        VALUES (NEW.id, 'activation', cleared_count);

        -- Deactivate all other set lists
        UPDATE set_lists
        SET is_active = false
        WHERE id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for set list activation
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
CREATE TRIGGER handle_set_list_activation_trigger
    BEFORE UPDATE OF is_active ON set_lists
    FOR EACH ROW
    WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION handle_set_list_activation();

-- Add index to optimize active status check
CREATE INDEX IF NOT EXISTS idx_set_lists_is_active ON set_lists(is_active)
WHERE is_active = true;