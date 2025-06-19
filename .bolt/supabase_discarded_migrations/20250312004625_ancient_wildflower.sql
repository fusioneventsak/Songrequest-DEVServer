/*
  # Fix Set List Activation

  1. Changes
    - Drop existing triggers and functions
    - Create simplified activation function
    - Add proper indexes
    - Ensure proper cascade delete
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();

-- Create simple activation function
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
    -- If activating a set list
    IF NEW.is_active = true THEN
        -- Deactivate all other set lists
        UPDATE set_lists 
        SET is_active = false 
        WHERE id != NEW.id;
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

-- Drop and recreate foreign key with cascade delete
ALTER TABLE set_list_songs 
DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;

ALTER TABLE set_list_songs
ADD CONSTRAINT set_list_songs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_set_lists_active 
    ON set_lists(is_active) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_set_list_songs_set_list_id 
    ON set_list_songs(set_list_id);