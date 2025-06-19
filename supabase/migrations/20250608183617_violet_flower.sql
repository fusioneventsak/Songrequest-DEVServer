/*
  # Add Atomic Lock Request Function
  
  1. Changes
    - Add a database function to handle request locking in a single transaction
    - This improves performance and reduces race conditions
    - Add index for faster lock queries
  
  2. Security
    - Function uses SECURITY DEFINER to ensure consistent permissions
    - Explicit search_path to prevent SQL injection
*/

-- Create a function for atomic lock operations
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

-- Create a function to unlock a request
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

-- Add index for faster lock queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_requests_is_locked 
ON requests(is_locked) 
WHERE is_locked = true;