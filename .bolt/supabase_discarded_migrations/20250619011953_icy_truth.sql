/*
  # Optimized Database Functions for Better Performance

  1. Database Functions
    - `add_vote` - Atomic voting with duplicate prevention
    - `lock_request` - Efficient request locking
    - `unlock_request` - Request unlocking
    - `get_requests_with_votes` - Aggregated request data
    - `refresh_request_stats` - Materialized view refresh

  2. Performance Indexes
    - Composite indexes for common query patterns
    - Partial indexes for active requests
    - Optimized lookup indexes

  3. Materialized View
    - Pre-computed request statistics
    - Faster queries for heavy operations

  4. Security
    - Proper function permissions
    - Security definer functions
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS add_vote(UUID, TEXT);
DROP FUNCTION IF EXISTS lock_request(UUID);
DROP FUNCTION IF EXISTS unlock_request(UUID);
DROP FUNCTION IF EXISTS get_requests_with_votes();
DROP FUNCTION IF EXISTS refresh_request_stats();

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS mv_request_stats;

-- Create optimized vote function with better error handling
CREATE OR REPLACE FUNCTION add_vote(p_request_id UUID, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vote_exists BOOLEAN;
  current_votes INTEGER;
BEGIN
  -- Check if vote already exists (fast lookup with index)
  SELECT EXISTS(
    SELECT 1 FROM user_votes 
    WHERE request_id = p_request_id AND user_id = p_user_id
  ) INTO vote_exists;
  
  IF vote_exists THEN
    RETURN FALSE; -- Already voted
  END IF;
  
  -- Get current vote count
  SELECT votes INTO current_votes 
  FROM requests 
  WHERE id = p_request_id;
  
  -- Handle case where request doesn't exist
  IF current_votes IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Insert vote and increment counter atomically
  BEGIN
    INSERT INTO user_votes (request_id, user_id, created_at) 
    VALUES (p_request_id, p_user_id, NOW());
    
    UPDATE requests 
    SET votes = votes + 1 
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
  -- Single atomic operation to unlock all and lock one
  UPDATE requests 
  SET is_locked = CASE WHEN id = request_id THEN true ELSE false END
  WHERE is_locked = true OR id = request_id;
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
  UPDATE requests 
  SET is_locked = false 
  WHERE id = request_id AND is_locked = true;
END;
$$;

-- Create function to get requests with aggregated data
CREATE OR REPLACE FUNCTION get_requests_with_votes()
RETURNS TABLE(
  id UUID,
  title TEXT,
  artist TEXT,
  votes INTEGER,
  status TEXT,
  is_locked BOOLEAN,
  is_played BOOLEAN,
  created_at TIMESTAMPTZ,
  requester_count BIGINT,
  latest_request TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.title,
    r.artist,
    r.votes,
    r.status,
    r.is_locked,
    r.is_played,
    r.created_at,
    COUNT(req.id) as requester_count,
    MAX(req.created_at) as latest_request
  FROM requests r
  LEFT JOIN requesters req ON r.id = req.request_id
  WHERE r.is_played = false
  GROUP BY r.id, r.title, r.artist, r.votes, r.status, r.is_locked, r.is_played, r.created_at
  ORDER BY 
    r.is_locked DESC,
    (r.votes + COUNT(req.id)) DESC,
    MAX(req.created_at) DESC;
END;
$$;

-- Performance indexes for faster queries (without CONCURRENTLY)
CREATE INDEX IF NOT EXISTS idx_user_votes_composite 
ON user_votes (request_id, user_id);

CREATE INDEX IF NOT EXISTS idx_requests_active_priority 
ON requests (is_played, is_locked DESC, votes DESC, created_at DESC) 
WHERE is_played = false;

CREATE INDEX IF NOT EXISTS idx_requesters_request_timestamp 
ON requesters (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requests_title_artist_active 
ON requests (title, artist) 
WHERE is_played = false;

-- Create materialized view for heavy queries (optional, for very high traffic)
CREATE MATERIALIZED VIEW mv_request_stats AS
SELECT 
  r.id,
  r.title,
  r.artist,
  r.votes,
  r.is_locked,
  r.is_played,
  r.created_at,
  COUNT(req.id) as requester_count,
  MAX(req.created_at) as latest_request
FROM requests r
LEFT JOIN requesters req ON r.id = req.request_id
WHERE r.is_played = false
GROUP BY r.id, r.title, r.artist, r.votes, r.status, r.is_locked, r.is_played, r.created_at;

-- Index the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_request_stats_pkey ON mv_request_stats (id);
CREATE INDEX IF NOT EXISTS mv_request_stats_priority ON mv_request_stats (is_locked DESC, votes DESC, latest_request DESC);

-- Function to refresh the materialized view (call periodically)
CREATE OR REPLACE FUNCTION refresh_request_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_request_stats;
END;
$$;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION add_vote(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_requests_with_votes() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_request_stats() TO authenticated;
GRANT SELECT ON mv_request_stats TO authenticated;

-- Grant permissions to anon users for public access
GRANT EXECUTE ON FUNCTION add_vote(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_requests_with_votes() TO anon;
GRANT SELECT ON mv_request_stats TO anon;

-- Analyze tables for better query planning
ANALYZE requests;
ANALYZE user_votes;
ANALYZE requesters;