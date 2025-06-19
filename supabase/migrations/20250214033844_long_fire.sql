/*
  # Update Set List Policies

  1. Changes
    - Drop existing set list policies
    - Create new, more permissive policies for set lists and related tables
    - Ensure proper access for all CRUD operations
  
  2. Security
    - Enable public access for all operations on set lists
    - Maintain data integrity with proper constraints
*/

-- Drop existing policies for set_lists
DROP POLICY IF EXISTS "Allow public read access to set_lists" ON set_lists;
DROP POLICY IF EXISTS "Allow authenticated users to manage set_lists" ON set_lists;
DROP POLICY IF EXISTS "Enable realtime for all users" ON set_lists;

-- Create new, more permissive policies for set_lists
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

-- Drop existing policies for set_list_songs
DROP POLICY IF EXISTS "Allow public read access to set_list_songs" ON set_list_songs;
DROP POLICY IF EXISTS "Allow authenticated users to manage set_list_songs" ON set_list_songs;
DROP POLICY IF EXISTS "Enable realtime for all users" ON set_list_songs;

-- Create new policies for set_list_songs
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