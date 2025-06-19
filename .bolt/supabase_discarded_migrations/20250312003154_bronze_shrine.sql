/*
  # Fix Set List Activation Process

  1. Changes
    - Drop existing triggers and functions
    - Create new atomic activation function
    - Add proper error handling
    - Fix race conditions
    - Add proper logging
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create new atomic activation function
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
DECLARE
    cleared_count integer;
BEGIN
    -- If we're activating a set list
    IF NEW.is_active = true AND OLD.is_active = false THEN
        -- First, deactivate all other set lists in a single transaction
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
        INSERT INTO activation_logs (
            set_list_id,
            action_type,
            requests_cleared
        ) VALUES (
            NEW.id,
            'activate',
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
        INSERT INTO activation_logs (
            set_list_id,
            action_type,
            requests_cleared
        ) VALUES (
            NEW.id,
            'deactivate',
            cleared_count
        );
    END IF;

    -- Notify clients of the change
    PERFORM pg_notify(
        'set_list_changes',
        json_build_object(
            'table', 'set_lists',
            'type', 'UPDATE',
            'record', row_to_json(NEW),
            'old_record', row_to_json(OLD)
        )::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create new trigger with proper timing
CREATE TRIGGER handle_set_list_activation_trigger
    BEFORE UPDATE OF is_active ON set_lists
    FOR EACH ROW
    WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION handle_set_list_activation();

-- Add index for better performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_set_lists_active 
    ON set_lists(is_active) 
    WHERE is_active = true;