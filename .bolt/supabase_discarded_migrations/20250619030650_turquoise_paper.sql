/*
  # Performance Optimization Migration
  
  1. Database Schema Fixes
    - Standardize album art column naming
    - Add missing updated_at triggers
    
  2. Performance Indexes
    - Add comprehensive indexes for all slow queries
    - Optimize request queue operations
    - Improve search and filtering performance
    
  3. Database Functions
    - Optimized lock/unlock operations
    - Atomic voting system
    
  4. Data Integrity
    - Add proper constraints
    - Clean up existing data
*/

-- First, let's check and standardize the songs table structure
DO $$
BEGIN
  -- Check if albumArtUrl column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'songs' AND column_name = 'albumArtUrl'
  ) THEN
    -- Check if album_art_url exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'songs' AND column_name = 'album_art_url'
    ) THEN
      ALTER TABLE songs RENAME COLUMN album_art_url TO "albumArtUrl";
    ELSE
      -- Add the column if neither exists
      ALTER TABLE songs ADD COLUMN "albumArtUrl" TEXT;
    END IF;
  END IF;
END $$;

-- Ensure all tables have proper updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_songs_updated_at'
  ) THEN
    CREATE TRIGGER update_songs_updated_at 
      BEFORE UPDATE ON songs 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ui_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_ui_settings_updated_at 
      BEFORE UPDATE ON ui_settings 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create critical performance indexes (without CONCURRENTLY to avoid transaction block error)
CREATE INDEX IF NOT EXISTS idx_requests_priority 
ON requests (votes DESC, created_at) 
WHERE is_played = false;

CREATE INDEX IF NOT EXISTS idx_requests_active_priority 
ON requests (is_played, is_locked DESC, votes DESC, created_at DESC) 
WHERE is_played = false;

CREATE INDEX IF NOT EXISTS idx_requests_title_artist_active 
ON requests (title, artist) 
WHERE is_played = false;

CREATE INDEX IF NOT EXISTS idx_requests_is_locked 
ON requests (is_locked) 
WHERE is_locked = true;

CREATE INDEX IF NOT EXISTS idx_requests_is_played 
ON requests (is_played);

CREATE INDEX IF NOT EXISTS idx_requests_title 
ON requests (title);

CREATE INDEX IF NOT EXISTS idx_requests_title_artist 
ON requests (title, artist);

CREATE INDEX IF NOT EXISTS idx_requests_created_at 
ON requests (created_at);

CREATE INDEX IF NOT EXISTS idx_requests_lookup 
ON requests (is_played, votes DESC, created_at DESC) 
WHERE is_played = false;

CREATE INDEX IF NOT EXISTS idx_requests_title_not_played 
ON requests (title, is_played) 
WHERE is_played = false;

-- User votes indexes
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup 
ON user_votes (request_id, user_id);

CREATE INDEX IF NOT EXISTS idx_user_votes_composite 
ON user_votes (request_id, user_id);

-- Requesters indexes
CREATE INDEX IF NOT EXISTS idx_requesters_request_id 
ON requesters (request_id);

CREATE INDEX IF NOT EXISTS idx_requesters_created_at 
ON requesters (created_at);

CREATE INDEX IF NOT EXISTS idx_requesters_request_id_name 
ON requesters (request_id, name);

CREATE INDEX IF NOT EXISTS idx_requesters_request_timestamp 
ON requesters (request_id, created_at DESC);

-- Songs indexes
CREATE INDEX IF NOT EXISTS idx_songs_title_artist 
ON songs (title, artist);

-- Set lists indexes
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

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS add_vote(UUID, TEXT);
DROP FUNCTION IF EXISTS lock_request(UUID);
DROP FUNCTION IF EXISTS unlock_request(UUID);

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

-- Create optimized vote function
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

-- Ensure proper constraints exist
DO $$
BEGIN
  -- Add constraint to ensure request titles are not empty
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'request_title_not_empty'
  ) THEN
    ALTER TABLE requests 
    ADD CONSTRAINT request_title_not_empty 
    CHECK (TRIM(BOTH FROM title) <> '');
  END IF;
  
  -- Add constraint to ensure requester names are not empty
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'requester_name_not_empty'
  ) THEN
    ALTER TABLE requesters 
    ADD CONSTRAINT requester_name_not_empty 
    CHECK (TRIM(BOTH FROM name) <> '');
  END IF;
  
  -- Add constraint to ensure requester photos are not empty
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'requester_photo_not_empty'
  ) THEN
    ALTER TABLE requesters 
    ADD CONSTRAINT requester_photo_not_empty 
    CHECK (photo IS NOT NULL AND photo <> '');
  END IF;
  
  -- Add constraint to limit message length
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'message_length_check'
  ) THEN
    ALTER TABLE requesters 
    ADD CONSTRAINT message_length_check 
    CHECK (char_length(message) <= 100);
  END IF;
END $$;

-- Update any existing data to ensure consistency
UPDATE requests SET votes = 0 WHERE votes IS NULL;
UPDATE requests SET status = 'pending' WHERE status IS NULL;
UPDATE requests SET is_locked = false WHERE is_locked IS NULL;
UPDATE requests SET is_played = false WHERE is_played IS NULL;

-- Analyze tables for better query planning
ANALYZE requests;
ANALYZE user_votes;
ANALYZE requesters;
ANALYZE songs;
ANALYZE set_lists;
ANALYZE set_list_songs;
ANALYZE ui_settings;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION lock_request(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION unlock_request(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_vote(UUID, TEXT) TO authenticated, anon;