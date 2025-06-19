/*
  # Add Atomic Lock Request Function
  
  1. Changes
    - Add a database function for atomic lock operations
    - This ensures locking/unlocking happens in a single transaction
    - Improves performance and reliability
    
  2. Security
    - Function uses SECURITY DEFINER to ensure proper permissions
    - Explicit search_path to prevent SQL injection
*/

-- Create a function for atomic lock operations
CREATE OR REPLACE FUNCTION lock_request(request_id UUID, should_lock BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If we're locking the request
  IF should_lock THEN
    -- First, unlock all requests
    UPDATE requests 
    SET is_locked = false 
    WHERE is_locked = true;
    
    -- Then lock the specified request
    UPDATE requests 
    SET is_locked = true 
    WHERE id = request_id;
  ELSE
    -- Just unlock the specified request
    UPDATE requests 
    SET is_locked = false 
    WHERE id = request_id;
  END IF;
END;
$$;

-- Add index for faster lock queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_requests_is_locked ON requests(is_locked) WHERE is_locked = true;