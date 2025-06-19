/*
  # Fix UPDATE Without WHERE Clause Issue

  1. Changes
    - Modify the handle_set_list_activation() function to safely update set list activation
    - Fix trigger that handles set list activation/deactivation
    - Add proper constraints and validation 
    
  2. Security
    - Maintain existing RLS policies
*/

-- First, drop the existing trigger and function
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create a better function to handle set list activation
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
    -- If we're activating a set list
    IF NEW.is_active = true AND OLD.is_active = false THEN
        -- Deactivate all set lists EXCEPT the one being activated
        UPDATE set_lists 
        SET is_active = false 
        WHERE id IS DISTINCT FROM NEW.id;
        
        -- Do not modify NEW here as we want the activation state to remain true
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

-- Create a function to validate set list names to prevent NULL values
CREATE OR REPLACE FUNCTION validate_set_list_name()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure name is never NULL
    IF NEW.name IS NULL THEN
        NEW.name := 'Unnamed Set List';
    END IF;
    
    -- Ensure date is never NULL
    IF NEW.date IS NULL THEN
        NEW.date := CURRENT_DATE;
    END IF;
    
    -- Ensure notes is not NULL
    IF NEW.notes IS NULL THEN
        NEW.notes := '';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for set list name validation
DROP TRIGGER IF EXISTS validate_set_list_name_trigger ON set_lists;
CREATE TRIGGER validate_set_list_name_trigger
    BEFORE INSERT OR UPDATE ON set_lists
    FOR EACH ROW
    EXECUTE FUNCTION validate_set_list_name();

-- Verify cascade delete is set up correctly
ALTER TABLE queue_reset_logs 
DROP CONSTRAINT IF EXISTS queue_reset_logs_set_list_id_fkey;

ALTER TABLE queue_reset_logs
ADD CONSTRAINT queue_reset_logs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Fix existing NULL values
UPDATE set_lists 
SET name = 'Unnamed Set List' 
WHERE name IS NULL;

UPDATE set_lists 
SET notes = '' 
WHERE notes IS NULL;

UPDATE set_lists 
SET date = CURRENT_DATE 
WHERE date IS NULL;