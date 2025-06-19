/*
  # Fix Set List Deletion

  1. Changes
    - Drop existing foreign key constraints
    - Recreate constraints with proper cascade delete
    - Add indexes for better performance
    - Update RLS policies to ensure delete access
*/

-- Drop existing foreign key constraints
ALTER TABLE set_list_songs 
DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;

-- Recreate foreign key with cascade delete
ALTER TABLE set_list_songs
ADD CONSTRAINT set_list_songs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_set_list_songs_set_list_id 
ON set_list_songs(set_list_id);

-- Ensure proper RLS policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'set_lists' 
    AND policyname = 'Public delete access to set_lists'
  ) THEN
    CREATE POLICY "Public delete access to set_lists"
      ON set_lists
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;