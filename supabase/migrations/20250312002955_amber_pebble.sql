/*
  # Fix Set List Activation and Queue Reset

  1. Changes
    - Add trigger to properly handle set list activation
    - Add function to reset request queue on activation
    - Add logging for activation events
    - Add proper constraints and indexes
  
  2. Security
    - Maintain existing RLS policies
*/

-- Create a table to log activation events
CREATE TABLE IF NOT EXISTS activation_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    set_list_id uuid REFERENCES set_lists(id),
    action_type text NOT NULL CHECK (action_type IN ('activate', 'deactivate')),
    requests_cleared integer,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on the logs table
ALTER TABLE activation_logs ENABLE ROW LEVEL SECURITY;

-- Add policy for activation logs
CREATE POLICY "Allow public to read activation logs"
    ON activation_logs
    FOR SELECT
    TO public
    USING (true);

-- Create a function to handle set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
DECLARE
    cleared_count integer;
BEGIN
    -- If we're activating a set list
    IF NEW.is_active = true AND OLD.is_active = false THEN
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
        'set_list_activation',
        json_build_object(
            'set_list_id', NEW.id,
            'is_active', NEW.is_active
        )::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;

-- Create new trigger with proper timing
CREATE TRIGGER handle_set_list_activation_trigger
    BEFORE UPDATE OF is_active ON set_lists
    FOR EACH ROW
    WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION handle_set_list_activation();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_set_lists_active ON set_lists(is_active)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_activation_logs_created_at 
ON activation_logs(created_at DESC);

-- Add notify function for realtime updates
CREATE OR REPLACE FUNCTION notify_set_list_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'set_list_changes',
        json_build_object(
            'table', TG_TABLE_NAME,
            'type', TG_OP,
            'record', row_to_json(NEW)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for set list changes
CREATE TRIGGER notify_set_list_changes
    AFTER INSERT OR UPDATE OR DELETE ON set_lists
    FOR EACH ROW
    EXECUTE FUNCTION notify_set_list_changes();