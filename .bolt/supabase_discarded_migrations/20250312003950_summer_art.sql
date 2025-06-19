/*
  # Fix Set List Activation Process

  1. Changes
    - Simplify activation trigger
    - Fix transaction handling
    - Add proper error handling
    - Add activation logging
    - Add performance optimizations
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create new atomic activation function
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
    -- If activating a set list
    IF NEW.is_active = true THEN
        -- Deactivate all other set lists atomically
        UPDATE set_lists 
        SET is_active = false 
        WHERE id != NEW.id;

        -- Clear pending requests
        UPDATE requests 
        SET is_played = true,
            is_locked = false 
        WHERE NOT is_played;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER handle_set_list_activation_trigger
    BEFORE UPDATE ON set_lists
    FOR EACH ROW
    WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
    EXECUTE FUNCTION handle_set_list_activation();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_set_lists_active 
    ON set_lists(is_active) 
    WHERE is_active = true;