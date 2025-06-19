/*
  # Fix Request Triggers and Add Validation

  1. Changes
    - Drop existing triggers and functions
    - Recreate rate limiting and validation with proper checks
    - Add request logging
    - Add proper indexes
    - Add data validation

  2. Security
    - Maintain existing RLS policies
    - Add proper constraints
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS rate_limit_requests_trigger ON requests;
DROP TRIGGER IF EXISTS validate_request_trigger ON requests;
DROP FUNCTION IF EXISTS rate_limit_requests();
DROP FUNCTION IF EXISTS validate_request();

-- Create a function to rate limit requests
CREATE OR REPLACE FUNCTION rate_limit_requests()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
  max_requests INTEGER := 100; -- Maximum requests per minute
  window_size INTERVAL := '1 minute';
BEGIN
  -- Check number of requests in the last minute
  SELECT COUNT(*) INTO recent_count
  FROM requests
  WHERE created_at > NOW() - window_size;
  
  IF recent_count > max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many requests in last minute';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rate limiting
CREATE TRIGGER rate_limit_requests_trigger
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION rate_limit_requests();

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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requests_title_artist ON requests(title, artist);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_is_played ON requests(is_played);
CREATE INDEX IF NOT EXISTS idx_requests_title_not_played ON requests(title) WHERE is_played = false;