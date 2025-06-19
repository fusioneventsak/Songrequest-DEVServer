/*
  # Clear Set List Data and Fix Activation Trigger
  
  1. Changes
    - Safely clear all set list related data
    - Update activation trigger logic
    - Add performance optimization index
  
  2. Notes
    - Uses TRUNCATE instead of DELETE for efficiency
    - Ensures proper trigger cleanup and recreation
    - Adds index for better performance
*/

-- Clear all set list data safely
TRUNCATE TABLE set_list_songs CASCADE;
TRUNCATE TABLE set_lists CASCADE;

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create a new function to handle set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true AND OLD.is_active = false THEN
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger with proper timing and conditions
CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_set_lists_is_active ON set_lists(is_active)
WHERE is_active = true;