/*
  # Fix Set List Deletion

  1. Changes
    - Drop and recreate foreign key with cascade delete
    - Add proper RLS policies for deletion
    - Add indexes for better performance
    - Clean up any orphaned records
*/

-- First clean up any orphaned records
DELETE FROM set_list_songs
WHERE set_list_id NOT IN (SELECT id FROM set_lists);

-- Drop and recreate foreign key with cascade delete
ALTER TABLE set_list_songs 
DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;

ALTER TABLE set_list_songs
ADD CONSTRAINT set_list_songs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Ensure proper RLS policies exist
DROP POLICY IF EXISTS "Public delete access to set_lists" ON set_lists;
DROP POLICY IF EXISTS "Public delete access to set_list_songs" ON set_list_songs;

CREATE POLICY "Public delete access to set_lists"
  ON set_lists
  FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Public delete access to set_list_songs"
  ON set_list_songs
  FOR DELETE
  TO public
  USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_set_list_songs_set_list_id 
ON set_list_songs(set_list_id);

-- Add index for active status
CREATE INDEX IF NOT EXISTS idx_set_lists_active 
ON set_lists(is_active) 
WHERE is_active = true;