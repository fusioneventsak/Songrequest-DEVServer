/*
  # Add request validation and logging

  1. Changes
    - Drop existing triggers and functions
    - Add request validation function and trigger
    - Add request logging function and trigger
    - Add performance indexes
*/

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS rate_limit_requests_trigger ON requests;
DROP TRIGGER IF EXISTS validate_request_trigger ON requests;
DROP FUNCTION IF EXISTS rate_limit_requests();
DROP FUNCTION IF EXISTS validate_request();

-- Create a function to validate requests
CREATE OR REPLACE FUNCTION validate_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure title is not empty
  IF NEW.title IS NULL OR trim(NEW.title) = '' THEN
    RAISE EXCEPTION 'Request title cannot be empty';
  END IF;

  -- Set default values
  NEW.votes := COALESCE(NEW.votes, 0);
  NEW.status := COALESCE(NEW.status, 'pending');
  NEW.is_locked := COALESCE(NEW.is_locked, false);
  NEW.is_played := COALESCE(NEW.is_played, false);
  NEW.created_at := COALESCE(NEW.created_at, now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for request validation
CREATE TRIGGER validate_request_trigger
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION validate_request();

-- Create a function to log request creation
CREATE OR REPLACE FUNCTION log_request_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO request_logs (request_id, title, artist, success)
  VALUES (NEW.id, NEW.title, NEW.artist, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for request logging
CREATE TRIGGER log_request_creation_trigger
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_creation();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requests_title_artist ON requests(title, artist);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_is_played ON requests(is_played);
CREATE INDEX IF NOT EXISTS idx_requests_title_not_played ON requests(title) WHERE is_played = false;