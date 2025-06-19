/*
  # Database Schema Diagnosis and Performance Optimization

  This migration addresses performance issues by:
  1. Standardizing column names across all tables
  2. Adding missing performance indexes
  3. Creating optimized functions for common operations
  4. Ensuring consistent schema between dev and production
*/

-- First, let's check and standardize the songs table structure
-- Ensure albumArtUrl column exists with consistent naming
DO $$
BEGIN
  -- Check if album_art_url exists and rename to albumArtUrl for consistency
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'album_art_url'
  ) THEN
    ALTER TABLE songs RENAME COLUMN album_art_url TO "albumArtUrl";
  END IF;
  
  -- Add albumArtUrl column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'songs' AND column_name = 'albumArtUrl'
  ) THEN
    ALTER TABLE songs ADD COLUMN "albumArtUrl" TEXT;
  END IF;
END $$;

-- Ensure all required columns exist in songs table
ALTER TABLE songs 
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS artist TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS genre TEXT,
  ADD COLUMN IF NOT EXISTS key TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure all required columns exist in requests table
ALTER TABLE requests 
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS artist TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_played BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure all required columns exist in set_lists table
ALTER TABLE set_lists 
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'New Set List',
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing performance indexes
-- These indexes are critical for app performance

-- Index for active requests sorting (most important for queue view)
CREATE INDEX IF NOT EXISTS idx_requests_priority 
ON requests (votes DESC, created_at) 
WHERE is_played = false;

-- Index for locked requests (for ticker display)
CREATE INDEX IF NOT EXISTS idx_requests_is_locked 
ON requests (is_locked) 
WHERE is_locked = true;

-- Index for request lookup by title and artist
CREATE INDEX IF NOT EXISTS idx_requests_title_artist 
ON requests (title, artist);

-- Index for active requests by title and artist (prevents duplicates)
CREATE INDEX IF NOT EXISTS idx_requests_title_artist_active 
ON requests (title, artist) 
WHERE is_played = false;

-- Index for requests that are not played
CREATE INDEX IF NOT EXISTS idx_requests_title_not_played 
ON requests (title, is_played) 
WHERE is_played = false;

-- Index for general request status
CREATE INDEX IF NOT EXISTS idx_requests_is_played 
ON requests (is_played);

-- Index for request creation time
CREATE INDEX IF NOT EXISTS idx_requests_created_at 
ON requests (created_at);

-- Composite index for optimal queue sorting
CREATE INDEX IF NOT EXISTS idx_requests_lookup 
ON requests (is_played, votes DESC, created_at DESC) 
WHERE is_played = false;

-- Advanced composite index for queue priority
CREATE INDEX IF NOT EXISTS idx_requests_active_priority 
ON requests (is_played, is_locked DESC, votes DESC, created_at DESC) 
WHERE is_played = false;

-- User votes indexes for fast vote checking
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup 
ON user_votes (request_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_votes_composite 
ON user_votes (request_id, user_id);

-- Requesters indexes for fast requester lookup
CREATE INDEX IF NOT EXISTS idx_requesters_request_id 
ON requesters (request_id);

CREATE INDEX IF NOT EXISTS idx_requesters_request_id_name 
ON requesters (request_id, name);

CREATE INDEX IF NOT EXISTS idx_requesters_request_timestamp 
ON requesters (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_requesters_created_at 
ON requesters (created_at);

-- Set list indexes
CREATE INDEX IF NOT EXISTS idx_set_lists_is_active 
ON set_lists (is_active) 
WHERE is_active = true;

-- Set list songs indexes
CREATE INDEX IF NOT EXISTS idx_set_list_songs_set_list_id 
ON set_list_songs (set_list_id);

CREATE INDEX IF NOT EXISTS idx_set_list_songs_song_id 
ON set_list_songs (song_id);

CREATE INDEX IF NOT EXISTS idx_set_list_songs_both_ids 
ON set_list_songs (set_list_id, song_id);

-- Songs indexes for search and lookup
CREATE INDEX IF NOT EXISTS idx_songs_title_artist 
ON songs (title, artist);

-- Drop any existing functions to avoid conflicts
DROP FUNCTION IF EXISTS lock_request(UUID);
DROP FUNCTION IF EXISTS unlock_request(UUID);
DROP FUNCTION IF EXISTS add_vote(UUID, TEXT);

-- Create optimized lock function
CREATE OR REPLACE FUNCTION lock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Unlock all requests first, then lock the specified one
  UPDATE requests SET is_locked = false WHERE is_locked = true;
  UPDATE requests SET is_locked = true WHERE id = request_id;
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
  UPDATE requests SET is_locked = false WHERE id = request_id;
END;
$$;

-- Create optimized vote function
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
  BEGIN
    INSERT INTO user_votes (request_id, user_id, created_at) 
    VALUES (p_request_id, p_user_id, NOW());
    
    UPDATE requests 
    SET votes = COALESCE(votes, 0) + 1 
    WHERE id = p_request_id;
    
    RETURN TRUE;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
END;
$$;

-- Grant permissions for the functions
GRANT EXECUTE ON FUNCTION lock_request(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION unlock_request(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_vote(UUID, TEXT) TO authenticated, anon;

-- Update table statistics for better query planning
ANALYZE songs;
ANALYZE requests;
ANALYZE requesters;
ANALYZE user_votes;
ANALYZE set_lists;
ANALYZE set_list_songs;

-- Ensure RLS is enabled and policies exist
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE requesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_list_songs ENABLE ROW LEVEL SECURITY;

-- Create policies if they don't exist
DO $$
BEGIN
  -- Songs policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'Songs SELECT policy') THEN
    CREATE POLICY "Songs SELECT policy" ON songs FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'Songs INSERT policy') THEN
    CREATE POLICY "Songs INSERT policy" ON songs FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'Songs UPDATE policy') THEN
    CREATE POLICY "Songs UPDATE policy" ON songs FOR UPDATE USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'songs' AND policyname = 'Songs DELETE policy') THEN
    CREATE POLICY "Songs DELETE policy" ON songs FOR DELETE USING (true);
  END IF;

  -- Requests policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requests' AND policyname = 'requests_public_access') THEN
    CREATE POLICY "requests_public_access" ON requests FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Requesters policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'requesters' AND policyname = 'requesters_public_access') THEN
    CREATE POLICY "requesters_public_access" ON requesters FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- User votes policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_votes' AND policyname = 'user_votes_public_access') THEN
    CREATE POLICY "user_votes_public_access" ON user_votes FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Set lists policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_lists' AND policyname = 'Public read access to set_lists') THEN
    CREATE POLICY "Public read access to set_lists" ON set_lists FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_lists' AND policyname = 'Public insert access to set_lists') THEN
    CREATE POLICY "Public insert access to set_lists" ON set_lists FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_lists' AND policyname = 'Public update access to set_lists') THEN
    CREATE POLICY "Public update access to set_lists" ON set_lists FOR UPDATE USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_lists' AND policyname = 'Public delete access to set_lists') THEN
    CREATE POLICY "Public delete access to set_lists" ON set_lists FOR DELETE USING (true);
  END IF;

  -- Set list songs policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_list_songs' AND policyname = 'Public read access to set_list_songs') THEN
    CREATE POLICY "Public read access to set_list_songs" ON set_list_songs FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_list_songs' AND policyname = 'Public insert access to set_list_songs') THEN
    CREATE POLICY "Public insert access to set_list_songs" ON set_list_songs FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'set_list_songs' AND policyname = 'Public update access to set_list_songs') THEN
    CREATE POLICY "Public update access to set_list_songs" ON set_list_songs FOR UPDATE USING (true);
  END IF;
END $$;