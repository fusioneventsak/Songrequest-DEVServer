/*
  # Fix notify_lock_change function with proper security settings

  1. Changes Made
    - Drop the existing trigger first to avoid dependency issues
    - Drop and recreate the notify_lock_change function with SECURITY DEFINER
    - Recreate the trigger with the updated function
    
  2. Security Improvements
    - Added SECURITY DEFINER to ensure function runs with definer's privileges
    - Set explicit search_path to prevent manipulation
    - Added proper logging for lock status changes
*/

-- Drop the existing trigger first to avoid dependency issues
DROP TRIGGER IF EXISTS lock_change_trigger ON requests;

-- Drop the existing function
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