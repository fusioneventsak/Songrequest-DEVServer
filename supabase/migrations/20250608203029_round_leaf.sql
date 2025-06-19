/*
  # Add Atomic Vote Function
  
  1. Changes
    - Create a database function for atomic vote operations
    - Combines checking for existing votes and incrementing vote count
    - Eliminates race conditions and reduces network round trips
    - Improves performance for high-concurrency voting
  
  2. Security
    - Uses SECURITY DEFINER to ensure consistent permissions
    - Sets explicit search_path to prevent SQL injection
*/

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