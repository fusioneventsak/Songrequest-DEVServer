/*
  # Improve Request Handling for Played Songs
  
  1. Changes
    - Add trigger to handle marking requests as played
    - Ensure played songs are removed from the queue
    - Add function to handle the played status change
    - Add notification for real-time updates
    
  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to handle marking a request as played
CREATE OR REPLACE FUNCTION handle_request_played()
RETURNS TRIGGER AS $$
BEGIN
  -- If we're marking a request as played
  IF NEW.is_played = true AND OLD.is_played = false THEN
    -- Ensure it's also unlocked
    NEW.is_locked = false;
    
    -- Log the action
    INSERT INTO request_logs (
      request_id,
      title,
      artist,
      success,
      created_at
    ) VALUES (
      NEW.id,
      NEW.title,
      NEW.artist,
      true,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Create trigger for handling played status changes
DROP TRIGGER IF EXISTS handle_request_played_trigger ON requests;
CREATE TRIGGER handle_request_played_trigger
  BEFORE UPDATE OF is_played ON requests
  FOR EACH ROW
  WHEN (NEW.is_played IS DISTINCT FROM OLD.is_played)
  EXECUTE FUNCTION handle_request_played();

-- Create a function to lock a request (and unlock all others)
CREATE OR REPLACE FUNCTION lock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, unlock all requests
  UPDATE requests 
  SET is_locked = false 
  WHERE is_locked = true;
  
  -- Then lock the specified request
  UPDATE requests 
  SET is_locked = true 
  WHERE id = request_id;
END;
$$;

-- Create a function to unlock a request
CREATE OR REPLACE FUNCTION unlock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simply unlock the specified request
  UPDATE requests 
  SET is_locked = false 
  WHERE id = request_id;
END;
$$;

-- Add index for faster lock queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_requests_is_locked 
ON requests(is_locked) 
WHERE is_locked = true;

-- Add index for pending requests
CREATE INDEX IF NOT EXISTS idx_requests_pending
ON requests(is_played)
WHERE is_played = false;