/*
  # Add Vote Tracking

  1. New Tables
    - `user_votes` table to track which users have voted for which requests
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key to requests)
      - `user_id` (text, to store user identifier)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on user_votes table
    - Add policies for public access
*/

-- Create user_votes table
CREATE TABLE IF NOT EXISTS user_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(request_id, user_id)
);

-- Enable RLS
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Public insert access to user_votes"
    ON user_votes
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Public read access to user_votes"
    ON user_votes
    FOR SELECT
    TO public
    USING (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_votes_request_user 
    ON user_votes(request_id, user_id);