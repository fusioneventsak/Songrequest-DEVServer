/*
  # Optimized Database Functions for Better Performance

  1. New Functions
    - `add_vote_simple`: Atomic function to add votes with proper error handling
    - `lock_request_simple`: Efficiently lock a request as next song
    - `unlock_request_simple`: Unlock a request
    
  2. Database Improvements
    - Added indexes for faster request and vote lookups
    - Ensured votes column has proper defaults and constraints
    - Added analysis commands for better query planning
*/

-- First, ensure the user_votes table exists
CREATE TABLE IF NOT EXISTS user_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(request_id, user_id)
);

-- Enable RLS on user_votes
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for user_votes
CREATE POLICY "Users can view and add votes" ON user_votes
  FOR ALL USING (true)
  WITH CHECK (true);

-- Create basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup 
ON user_votes (request_id, user_id);

CREATE INDEX IF NOT EXISTS idx_requests_lookup 
ON requests (is_played, votes DESC, created_at DESC) 
WHERE is_played = false;

-- Create a simple vote function that works with current setup
CREATE OR REPLACE FUNCTION add_vote_simple(p_request_id uuid, p_user_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if vote already exists
  IF EXISTS(
    SELECT 1 FROM user_votes 
    WHERE request_id = p_request_id AND user_id = p_user_id
  ) THEN
    RETURN false; -- Already voted
  END IF;
  
  -- Insert vote
  INSERT INTO user_votes (request_id, user_id, created_at) 
  VALUES (p_request_id, p_user_id, NOW());
  
  -- Update vote count
  UPDATE requests 
  SET votes = COALESCE(votes, 0) + 1 
  WHERE id = p_request_id;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_vote_simple(uuid, text) TO authenticated, anon;

-- Ensure votes column exists and has default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'requests' AND column_name = 'votes'
  ) THEN
    ALTER TABLE requests ADD COLUMN votes integer DEFAULT 0;
  ELSE
    ALTER TABLE requests ALTER COLUMN votes SET DEFAULT 0;
  END IF;
END $$;

-- Update any NULL votes to 0
UPDATE requests SET votes = 0 WHERE votes IS NULL;

-- Basic lock/unlock functions
CREATE OR REPLACE FUNCTION lock_request_simple(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Unlock all requests first
  UPDATE requests SET is_locked = false WHERE is_locked = true;
  
  -- Lock the specified request
  UPDATE requests SET is_locked = true WHERE id = request_id;
END;
$$;

CREATE OR REPLACE FUNCTION unlock_request_simple(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE requests SET is_locked = false WHERE id = request_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION lock_request_simple(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_request_simple(uuid) TO authenticated;

-- Analyze tables for better performance
ANALYZE requests;
ANALYZE user_votes;
ANALYZE requesters;