/*
  # Fix Function Search Path Mutable Security Warning
  
  1. Changes
    - Add SECURITY DEFINER to notify_lock_change function
    - Set explicit search_path to prevent SQL injection
    - Maintain existing function behavior
  
  2. Security
    - Follows Supabase security best practices
    - Prevents potential privilege escalation vulnerabilities
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS notify_lock_change();

-- Recreate the function with proper security settings
CREATE OR REPLACE FUNCTION notify_lock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Add SECURITY DEFINER to ensure function runs with definer's privileges
SET search_path = public  -- Explicitly set search_path to prevent manipulation
AS $$
BEGIN
  -- Log lock status changes for debugging
  IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
    RAISE NOTICE 'Lock status changed for request %: % -> %', NEW.id, OLD.is_locked, NEW.is_locked;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER lock_change_trigger
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_lock_change();