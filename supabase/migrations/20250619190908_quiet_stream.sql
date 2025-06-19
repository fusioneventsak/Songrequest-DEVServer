/*
  # Fix Voting System and Request Processing

  1. Changes
    - Add improved atomic voting function
    - Add function to check if a request is in processing state
    - Add index for faster vote lookups
    - Add constraint to prevent voting on played requests
  
  2. Security
    - Functions use SECURITY DEFINER to ensure consistent permissions
    - Explicit search_path to prevent SQL injection
*/

-- Create a more reliable atomic vote function
CREATE OR REPLACE FUNCTION add_vote(p_request_id UUID, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vote_exists BOOLEAN;
  is_played BOOLEAN;
BEGIN
  -- Check if request is played
  SELECT is_played INTO is_played FROM requests WHERE id = p_request_id;
  
  -- Don't allow voting on played requests
  IF is_played = true THEN
    RETURN FALSE;
  END IF;
  
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
  SET votes = COALESCE(votes, 0) + 1 
  WHERE id = p_request_id;
  
  RETURN TRUE; -- Success
EXCEPTION WHEN OTHERS THEN
  -- Log error and return false
  RAISE NOTICE 'Error in add_vote: %', SQLERRM;
  RETURN FALSE;
END;
$$;

-- Create a function to check if a request is in processing state
CREATE OR REPLACE FUNCTION is_request_processing(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A request is considered "processing" if it was created in the last 5 seconds
  RETURN EXISTS(
    SELECT 1 FROM requests
    WHERE id = p_request_id
    AND created_at > NOW() - INTERVAL '5 seconds'
  );
END;
$$;

-- Add index for faster vote lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_votes_request_id_user_id 
ON user_votes(request_id, user_id);

-- Add index for faster request lookups by played status
CREATE INDEX IF NOT EXISTS idx_requests_is_played 
ON requests(is_played);

-- Grant execute permissions to public
GRANT EXECUTE ON FUNCTION add_vote(UUID, TEXT) TO public;
GRANT EXECUTE ON FUNCTION is_request_processing(UUID) TO public;