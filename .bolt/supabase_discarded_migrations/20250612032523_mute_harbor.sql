/*
  # Consolidate RLS Policies and Remove Duplicate Indexes

  1. RLS Policy Consolidation
    - Replace multiple overlapping policies with single consolidated ones for requests table
    - Replace multiple overlapping policies with single consolidated ones for requesters table
    - Simplify policy management and improve performance

  2. Index Cleanup
    - Remove duplicate indexes that serve the same purpose
    - Keep the better-named indexes for clarity
    - Optimize database performance by reducing redundant indexes

  3. Security
    - Maintain public access requirements for the application
    - Ensure all necessary operations remain functional
*/

-- =============================================
-- CONSOLIDATE RLS POLICIES FOR REQUESTS TABLE
-- =============================================

-- Drop existing overlapping policies for requests
DROP POLICY IF EXISTS "Allow public insert access to requests" ON requests;
DROP POLICY IF EXISTS "Allow public read access to requests" ON requests;
DROP POLICY IF EXISTS "Allow public update access to requests" ON requests;
DROP POLICY IF EXISTS "Allow realtime for requests" ON requests;
DROP POLICY IF EXISTS "Requests INSERT policy" ON requests;
DROP POLICY IF EXISTS "Requests SELECT policy" ON requests;
DROP POLICY IF EXISTS "Requests UPDATE policy" ON requests;
DROP POLICY IF EXISTS "Requests DELETE policy" ON requests;

-- Create single consolidated policy for requests
CREATE POLICY "requests_public_access" ON requests
FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- CONSOLIDATE RLS POLICIES FOR REQUESTERS TABLE
-- =============================================

-- Drop existing overlapping policies for requesters
DROP POLICY IF EXISTS "Allow public insert access to requesters" ON requesters;
DROP POLICY IF EXISTS "Allow public read access to requesters" ON requesters;
DROP POLICY IF EXISTS "Allow public update access to requesters" ON requesters;
DROP POLICY IF EXISTS "Allow realtime for requesters" ON requesters;
DROP POLICY IF EXISTS "Requesters INSERT policy" ON requesters;
DROP POLICY IF EXISTS "Requesters SELECT policy" ON requesters;
DROP POLICY IF EXISTS "Requesters UPDATE policy" ON requesters;
DROP POLICY IF EXISTS "Requesters DELETE policy" ON requesters;

-- Create single consolidated policy for requesters
CREATE POLICY "requesters_public_access" ON requesters
FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- CONSOLIDATE RLS POLICIES FOR USER_VOTES TABLE
-- =============================================

-- Drop existing overlapping policies for user_votes
DROP POLICY IF EXISTS "Public insert access to user_votes" ON user_votes;
DROP POLICY IF EXISTS "Public read access to user_votes" ON user_votes;

-- Create single consolidated policy for user_votes
CREATE POLICY "user_votes_public_access" ON user_votes
FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- REMOVE DUPLICATE INDEXES
-- =============================================

-- Remove duplicate indexes, keeping the better-named ones
DROP INDEX IF EXISTS idx_requests_locked;  -- Keep idx_requests_is_locked instead
DROP INDEX IF EXISTS idx_user_votes_request_user;  -- Keep idx_user_votes_lookup instead

-- Remove other potential duplicates
DROP INDEX IF EXISTS idx_requests_pending;  -- Covered by idx_requests_is_played
DROP INDEX IF EXISTS idx_requests_title_artist_not_played;  -- Covered by idx_requests_title_artist

-- =============================================
-- VERIFY ESSENTIAL INDEXES EXIST
-- =============================================

-- Ensure we have the essential indexes (create if not exists)
CREATE INDEX IF NOT EXISTS idx_requests_is_locked ON requests (is_locked) WHERE (is_locked = true);
CREATE INDEX IF NOT EXISTS idx_requests_is_played ON requests (is_played);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests (votes DESC, created_at) WHERE (is_played = false);
CREATE INDEX IF NOT EXISTS idx_user_votes_lookup ON user_votes (request_id, user_id);
CREATE INDEX IF NOT EXISTS idx_requesters_request_id ON requesters (request_id);