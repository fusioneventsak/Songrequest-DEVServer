/*
  # Fix Set List Activation

  1. Changes
    - Drop existing trigger and function
    - Create new trigger function with proper transaction handling
    - Add proper logging and error handling
    - Fix activation state management
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create new function to handle set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
DECLARE
    cleared_count integer;
BEGIN
    -- If we're activating a set list
    IF NEW.is_active = true AND (OLD.is_active = false OR OLD.is_active IS NULL) THEN
        -- First, deactivate all other set lists
        UPDATE set_lists
        SET is_active = false
        WHERE id != NEW.id
          AND is_active = true;

        -- Get count of requests to be cleared
        SELECT COUNT(*) INTO cleared_count
        FROM requests
        WHERE NOT is_played;

        -- Clear all pending requests
        UPDATE requests
        SET is_played = true,
            is_locked = false
        WHERE NOT is_played;

        -- Log the activation
        INSERT INTO queue_reset_logs (
            set_list_id,
            reset_type,
            requests_cleared
        ) VALUES (
            NEW.id,
            'activation',
            cleared_count
        );

    -- If we're deactivating a set list
    ELSIF NEW.is_active = false AND OLD.is_active = true THEN
        -- Get count of requests to be cleared
        SELECT COUNT(*) INTO cleared_count
        FROM requests
        WHERE NOT is_played;

        -- Clear all pending requests
        UPDATE requests
        SET is_played = true,
            is_locked = false
        WHERE NOT is_played;

        -- Log the deactivation
        INSERT INTO queue_reset_logs (
            set_list_id,
            reset_type,
            requests_cleared
        ) VALUES (
            NEW.id,
            'deactivation',
            cleared_count
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger with proper timing
CREATE TRIGGER handle_set_list_activation_trigger
    BEFORE UPDATE OF is_active ON set_lists
    FOR EACH ROW
    WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION handle_set_list_activation();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_set_lists_active ON set_lists(is_active)
WHERE is_active = true;

-- Add index for set list songs to improve join performance
CREATE INDEX IF NOT EXISTS idx_set_list_songs_set_list_id ON set_list_songs(set_list_id);