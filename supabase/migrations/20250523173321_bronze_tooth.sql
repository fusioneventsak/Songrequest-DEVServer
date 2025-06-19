/*
  # Fix Function Search Path Security Warning

  1. Changes
    - Add SECURITY DEFINER to reset_request_queues function
    - Set explicit search_path to prevent potential security issues
    - Maintain existing function logic

  2. Security
    - Prevents SQL injection attacks via search_path manipulation
    - Follows PostgreSQL security best practices
*/

-- Fix reset_request_queues function to use SECURITY DEFINER and explicit search path
CREATE OR REPLACE FUNCTION public.reset_request_queues(p_set_list_id uuid, p_reset_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Add SECURITY DEFINER to ensure function runs with definer's privileges
SET search_path = public  -- Explicitly set search_path to prevent manipulation
AS $$
DECLARE
    cleared_count integer;
BEGIN
    -- Get count of requests to be cleared
    SELECT COUNT(*) INTO cleared_count
    FROM requests
    WHERE NOT is_played;

    -- Clear all pending requests
    UPDATE requests
    SET is_played = true,
        is_locked = false
    WHERE NOT is_played;

    -- Log the reset
    INSERT INTO queue_reset_logs (set_list_id, reset_type, requests_cleared)
    VALUES (p_set_list_id, p_reset_type, cleared_count);
END;
$$;