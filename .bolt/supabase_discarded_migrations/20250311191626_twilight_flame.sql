/*
  # Add Queue Reset System

  1. Changes
    - Add trigger to clear requests when set list is activated/deactivated
    - Add function to handle queue reset
    - Add logging for queue resets
  
  2. Security
    - Maintain existing RLS policies
*/

-- Create a table to log queue resets
CREATE TABLE IF NOT EXISTS queue_reset_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    set_list_id uuid REFERENCES set_lists(id),
    reset_type text NOT NULL CHECK (reset_type IN ('activation', 'deactivation', 'manual')),
    requests_cleared integer,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on the logs table
ALTER TABLE queue_reset_logs ENABLE ROW LEVEL SECURITY;

-- Add policy for queue reset logs
CREATE POLICY "Allow public to read queue reset logs"
    ON queue_reset_logs
    FOR SELECT
    TO public
    USING (true);

-- Create a function to reset queues
CREATE OR REPLACE FUNCTION reset_request_queues(p_set_list_id uuid, p_reset_type text)
RETURNS void AS $$
DECLARE
    cleared_count integer;
BEGIN
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
    VALUES (p_set_list_id, p_reset_type, cleared_count);
END;
$$ LANGUAGE plpgsql;

-- Create a function to handle set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
    -- If activating a set list
    IF NEW.is_active = true AND OLD.is_active = false THEN
        -- Deactivate all other set lists
        UPDATE set_lists
        SET is_active = false
        WHERE id != NEW.id;

        -- Reset queues
        PERFORM reset_request_queues(NEW.id, 'activation');
    -- If deactivating a set list
    ELSIF NEW.is_active = false AND OLD.is_active = true THEN
        -- Reset queues
        PERFORM reset_request_queues(NEW.id, 'deactivation');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;

-- Create new trigger for set list activation
CREATE TRIGGER handle_set_list_activation_trigger
    BEFORE UPDATE OF is_active ON set_lists
    FOR EACH ROW
    WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION handle_set_list_activation();