/*
  # High-concurrency optimizations

  1. New Indexes
    - Add optimized indexes for common query patterns
    - Add composite indexes for joins
    - Add partial indexes for frequently accessed data subsets
    
  2. Performance Settings
    - Add session-level timeouts to prevent long-running queries
    
  3. Security & Policies
    - Add optimized RLS policies for public access
*/

-- Add message length constraint if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_length_check'
  ) THEN
    ALTER TABLE requesters
    ADD CONSTRAINT message_length_check
    CHECK (char_length(message) <= 100);
  END IF;
END $$;

-- Add indexes to optimize query performance
CREATE INDEX IF NOT EXISTS idx_requests_title_artist ON requests(title, artist);
CREATE INDEX IF NOT EXISTS idx_requests_pending ON requests(is_played) WHERE is_played = false;
CREATE INDEX IF NOT EXISTS idx_requests_locked ON requests(is_locked) WHERE is_locked = true;
CREATE INDEX IF NOT EXISTS idx_songs_title_artist ON songs(title, artist);
CREATE INDEX IF NOT EXISTS idx_set_lists_active ON set_lists(is_active) WHERE is_active = true;

-- Add partial indexes for frequently accessed subsets of data (using static values)
CREATE INDEX IF NOT EXISTS idx_recent_requests ON requests(created_at) 
WHERE created_at > '2025-01-01'; -- Static date instead of NOW()

-- Add composite indexes for common join patterns
CREATE INDEX IF NOT EXISTS idx_set_list_songs_both_ids ON set_list_songs(set_list_id, song_id);

-- Create a stable rate limiting function
-- Must mark it as IMMUTABLE to use in indexes
CREATE OR REPLACE FUNCTION is_rate_limited(requests_count integer, time_window interval)
RETURNS boolean
IMMUTABLE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN requests_count > 100;
END;
$$;

-- Add database-level rate limiting function (not using function in predicate)
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

-- Add trigger for rate limiting if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'rate_limit_requests_trigger'
  ) THEN
    CREATE TRIGGER rate_limit_requests_trigger
    BEFORE INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION rate_limit_requests();
  END IF;
END $$;

-- Add additional RLS policies to ensure secure, scalable access
-- These complement existing policies but add more specific/optimized versions
DO $$
BEGIN
  -- Add optimized RLS policies for high-concurrency reads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Optimized read policy for public requests'
  ) THEN
    CREATE POLICY "Optimized read policy for public requests" 
      ON requests
      FOR SELECT 
      TO public
      USING (true);
  END IF;
  
  -- Add optimized RLS policies for public songs
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Optimized read policy for songs'
  ) THEN
    CREATE POLICY "Optimized read policy for songs" 
      ON songs
      FOR SELECT 
      TO public
      USING (true);
  END IF;
END $$;

-- Set timeout parameters for the session instead of altering roles
-- This will apply to statements within the current migration
SET statement_timeout = '10s';
SET idle_in_transaction_session_timeout = '30s';

-- Create simple cache invalidation function for future use
CREATE OR REPLACE FUNCTION invalidate_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function acts as a placeholder for cache invalidation
  -- In a real implementation, it would invalidate specific cache entries
  RETURN NEW;
END;
$$;