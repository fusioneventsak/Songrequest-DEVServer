/*
  # Fix requesters table for large photo payloads

  1. Changes
    - Modify requesters.photo column to support larger text content
    - Add text message length constraint for better performance
    - Update existing column types to ensure consistent data handling

  2. Performance Considerations
    - By explicitly using TEXT type we ensure column can hold larger content
    - Adding length constraint to message field prevents abuse
    - Using TEXT type provides most flexibility for different image sizes
*/

-- Alter photo column to explicitly use TEXT type to ensure it can hold larger content
ALTER TABLE requesters 
ALTER COLUMN photo TYPE TEXT;

-- Add constraint to limit message length for better performance
DO $$ 
BEGIN
  -- Create constraint only if it doesn't exist already
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_length_check'
  ) THEN
    ALTER TABLE requesters
    ADD CONSTRAINT message_length_check
    CHECK (char_length(message) <= 100);
  END IF;
END $$;

-- Create indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_requesters_request_id ON requesters(request_id);
CREATE INDEX IF NOT EXISTS idx_requesters_created_at ON requesters(created_at);

-- Ensure proper row level security policies exist
DO $$ 
BEGIN
  -- Create missing RLS policies if needed
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'Public full access to requesters'
  ) THEN
    CREATE POLICY "Public full access to requesters"
      ON requesters
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;