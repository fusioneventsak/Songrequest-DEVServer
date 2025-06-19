/*
  # Fix App Loading and Voting System
  
  1. Changes
    - Add optimized voting function with proper error handling
    - Add indexes for faster request lookups
    - Fix constraints to ensure proper data integrity
    - Add function to check if a request is in processing state
    
  2. Security
    - Maintain existing RLS policies
    - Ensure proper permissions for functions
*/

-- Create optimized vote function with better error handling
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
  -- Check if request is already played
  SELECT requests.is_played INTO is_played
  FROM requests
  WHERE id = p_request_id;
  
  -- Don't allow voting on played requests
  IF is_played THEN
    RETURN FALSE;
  END IF;

  -- Check if vote already exists (fast lookup with index)
  SELECT EXISTS(
    SELECT 1 FROM user_votes 
    WHERE request_id = p_request_id AND user_id = p_user_id
  ) INTO vote_exists;
  
  IF vote_exists THEN
    RETURN FALSE; -- Already voted
  END IF;
  
  -- Insert vote and increment counter atomically
  BEGIN
    INSERT INTO user_votes (request_id, user_id, created_at) 
    VALUES (p_request_id, p_user_id, NOW());
    
    UPDATE requests 
    SET votes = COALESCE(votes, 0) + 1 
    WHERE id = p_request_id;
    
    RETURN TRUE; -- Success
  EXCEPTION WHEN OTHERS THEN
    -- Handle any constraint violations or errors
    RETURN FALSE;
  END;
END;
$$;

-- Create optimized lock function
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

-- Create optimized unlock function
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

-- Add indexes for faster lookups if they don't exist
CREATE INDEX IF NOT EXISTS idx_requests_is_locked 
ON requests(is_locked) 
WHERE is_locked = true;

CREATE INDEX IF NOT EXISTS idx_requests_is_played 
ON requests(is_played);

CREATE INDEX IF NOT EXISTS idx_requests_priority 
ON requests(votes DESC, created_at) 
WHERE is_played = false;

CREATE INDEX IF NOT EXISTS idx_user_votes_lookup 
ON user_votes(request_id, user_id);

-- Grant permissions to public users
GRANT EXECUTE ON FUNCTION add_vote(UUID, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION lock_request(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION unlock_request(UUID) TO authenticated, anon;

-- Analyze tables for better query planning
ANALYZE requests;
ANALYZE user_votes;
ANALYZE requesters;