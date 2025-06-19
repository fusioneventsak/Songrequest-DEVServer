/*
  # Fix Function Search Path Mutable Warning
  
  1. Changes
    - Add SECURITY DEFINER to notify_lock_change function
    - Set explicit search_path to prevent SQL injection
    - Properly handle trigger dependency
    
  2. Security
    - Prevents potential SQL injection via search_path manipulation
    - Maintains same functionality with improved security
*/

-- First drop the trigger that depends on the function
DROP TRIGGER IF EXISTS lock_change_trigger ON requests;

-- Now we can safely drop and recreate the function
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