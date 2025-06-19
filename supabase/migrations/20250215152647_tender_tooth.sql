/*
  # Fix Set List Tables
  
  1. Changes
    - Recreate set_lists table with proper constraints
    - Recreate set_list_songs table with proper constraints
    - Set up proper indexes and foreign keys
    - Add RLS policies
  
  2. Notes
    - Ensures data integrity
    - Maintains proper relationships
    - Enables proper security
*/

-- Drop and recreate set_lists table
DROP TABLE IF EXISTS set_list_songs CASCADE;
DROP TABLE IF EXISTS set_lists CASCADE;

CREATE TABLE set_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    date date NOT NULL,
    notes text,
    is_active boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Create set_list_songs table
CREATE TABLE set_list_songs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    set_list_id uuid REFERENCES set_lists(id) ON DELETE CASCADE,
    song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
    position integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(set_list_id, position)
);

-- Create indexes for better performance
CREATE INDEX idx_set_lists_is_active ON set_lists(is_active) WHERE is_active = true;
CREATE INDEX idx_set_list_songs_set_list_id ON set_list_songs(set_list_id);

-- Create activation trigger
CREATE OR REPLACE FUNCTION handle_set_list_activation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE set_lists
    SET is_active = false
    WHERE id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE OF is_active ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Enable RLS
ALTER TABLE set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_list_songs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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