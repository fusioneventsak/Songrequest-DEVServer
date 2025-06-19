/*
  # Fix Request Creation and Add Debugging

  1. Changes
    - Add trigger to log request creation attempts
    - Add function to validate request data
    - Add constraint to ensure request title is not null
    - Add index for faster request lookups
    
  2. Security
    - Maintain existing RLS policies
*/

-- Create a table to log request creation attempts
CREATE TABLE IF NOT EXISTS request_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid,
    title text,
    artist text,
    created_at timestamptz DEFAULT now(),
    success boolean,
    error_message text
);

-- Enable RLS on the logs table
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

-- Add policy for request logs
CREATE POLICY "Allow public to insert logs"
    ON request_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Create a function to log request creation
CREATE OR REPLACE FUNCTION log_request_creation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO request_logs (request_id, title, artist, success, error_message)
    VALUES (
        NEW.id,
        NEW.title,
        NEW.artist,
        TRUE,
        NULL
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO request_logs (request_id, title, artist, success, error_message)
    VALUES (
        NULL,
        NEW.title,
        NEW.artist,
        FALSE,
        SQLERRM
    );
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for request creation logging
CREATE TRIGGER log_request_creation_trigger
    AFTER INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION log_request_creation();

-- Add index for faster request lookups
CREATE INDEX IF NOT EXISTS idx_requests_title_not_played 
    ON requests (title, is_played) 
    WHERE is_played = false;

-- Add constraint to ensure request title is not null
ALTER TABLE requests 
    ALTER COLUMN title SET NOT NULL;

-- Add function to validate request data
CREATE OR REPLACE FUNCTION validate_request()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure title is not empty
    IF NEW.title IS NULL OR trim(NEW.title) = '' THEN
        RAISE EXCEPTION 'Request title cannot be empty';
    END IF;

    -- Set default values if not provided
    NEW.votes := COALESCE(NEW.votes, 0);
    NEW.status := COALESCE(NEW.status, 'pending');
    NEW.is_locked := COALESCE(NEW.is_locked, false);
    NEW.is_played := COALESCE(NEW.is_played, false);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for request validation
CREATE TRIGGER validate_request_trigger
    BEFORE INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION validate_request();