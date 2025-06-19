-- First, clear existing data
DELETE FROM set_list_songs CASCADE;
DELETE FROM set_lists CASCADE;

-- Remove any existing triggers and functions
DROP TRIGGER IF EXISTS handle_set_list_activation_trigger ON set_lists;
DROP FUNCTION IF EXISTS handle_set_list_activation();
DROP TRIGGER IF EXISTS maintain_set_list_songs_position ON set_list_songs;
DROP FUNCTION IF EXISTS maintain_set_list_songs_position();
DROP FUNCTION IF EXISTS reorder_set_list_positions(UUID);

-- Remove existing indexes and constraints
DROP INDEX IF EXISTS idx_set_list_songs_position;
DROP INDEX IF EXISTS idx_set_list_songs_set_list_position;
DROP INDEX IF EXISTS idx_set_lists_is_active;
DROP INDEX IF EXISTS ensure_single_active_setlist;

-- Recreate set_lists table with proper constraints
ALTER TABLE set_lists DROP CONSTRAINT IF EXISTS set_lists_pkey CASCADE;
ALTER TABLE set_lists ADD PRIMARY KEY (id);
ALTER TABLE set_lists ALTER COLUMN name SET NOT NULL;
ALTER TABLE set_lists ALTER COLUMN date SET NOT NULL;
ALTER TABLE set_lists ALTER COLUMN is_active SET DEFAULT false;

-- Recreate set_list_songs table with proper constraints
ALTER TABLE set_list_songs DROP CONSTRAINT IF EXISTS set_list_songs_pkey CASCADE;
ALTER TABLE set_list_songs DROP CONSTRAINT IF EXISTS set_list_songs_set_list_id_fkey;
ALTER TABLE set_list_songs ADD PRIMARY KEY (id);
ALTER TABLE set_list_songs ADD CONSTRAINT set_list_songs_set_list_id_fkey 
  FOREIGN KEY (set_list_id) REFERENCES set_lists(id) ON DELETE CASCADE;

-- Create a trigger to handle set list activation
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

CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  EXECUTE FUNCTION handle_set_list_activation();

-- Create RLS policies for set_lists
DROP POLICY IF EXISTS "Public read access to set_lists" ON set_lists;
DROP POLICY IF EXISTS "Public insert access to set_lists" ON set_lists;
DROP POLICY IF EXISTS "Public update access to set_lists" ON set_lists;
DROP POLICY IF EXISTS "Public delete access to set_lists" ON set_lists;

CREATE POLICY "Public read access to set_lists"
  ON set_lists FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access to set_lists"
  ON set_lists FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public update access to set_lists"
  ON set_lists FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete access to set_lists"
  ON set_lists FOR DELETE
  TO public
  USING (true);

-- Create RLS policies for set_list_songs
DROP POLICY IF EXISTS "Public read access to set_list_songs" ON set_list_songs;
DROP POLICY IF EXISTS "Public insert access to set_list_songs" ON set_list_songs;
DROP POLICY IF EXISTS "Public update access to set_list_songs" ON set_list_songs;
DROP POLICY IF EXISTS "Public delete access to set_list_songs" ON set_list_songs;

CREATE POLICY "Public read access to set_list_songs"
  ON set_list_songs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public insert access to set_list_songs"
  ON set_list_songs FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Public update access to set_list_songs"
  ON set_list_songs FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public delete access to set_list_songs"
  ON set_list_songs FOR DELETE
  TO public
  USING (true);