/*
  # Optimize Request Locking and Voting
  
  1. Changes
    - Add atomic functions for request locking and unlocking
    - Add atomic function for vote operations
    - Add performance indexes for common query patterns
    
  2. Security
    - Use SECURITY DEFINER for functions
    - Set explicit search_path to prevent SQL injection
    - Maintain existing RLS policies
*/

-- Create a function to lock a request with optimized payload
CREATE OR REPLACE FUNCTION lock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First unlock all requests
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

-- Create a function for atomic vote operations
CREATE OR REPLACE FUNCTION add_vote(p_request_id UUID, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vote_exists BOOLEAN;
BEGIN
  -- Check if vote already exists
  SELECT EXISTS(
    SELECT 1 FROM user_votes 
    WHERE request_id = p_request_id AND user_id = p_user_id
  ) INTO vote_exists;
  
  IF vote_exists THEN
    RETURN FALSE; -- Already voted
  END IF;
  
  -- Insert vote and increment counter atomically
  INSERT INTO user_votes (request_id, user_id, created_at) 
  VALUES (p_request_id, p_user_id, NOW());
  
  UPDATE requests 
  SET votes = votes + 1 
  WHERE id = p_request_id;
  
  RETURN TRUE; -- Success
END;
$$;

-- Add index for faster vote lookups
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup 
ON user_votes (request_id, user_id);

-- Add index for faster queue sorting by priority
CREATE INDEX IF NOT EXISTS idx_requests_priority 
ON requests (votes DESC, created_at ASC) 
WHERE is_played = false;

-- Add index for faster lock queries
CREATE INDEX IF NOT EXISTS idx_requests_is_locked 
ON requests (is_locked) 
WHERE is_locked = true;

-- Add index for title and artist with is_played filter
CREATE INDEX IF NOT EXISTS idx_requests_title_artist_not_played 
ON requests (title, artist) 
WHERE is_played = false;

-- Note: Connection pooling settings have been removed as they require ALTER SYSTEM
-- which cannot be run inside a transaction block. These settings should be
-- configured at the database level outside of migrations.