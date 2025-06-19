/*
  # Update RLS policies for songs table

  1. Changes
    - Drop existing policies for songs table
    - Create new policies that allow both authenticated and anonymous users to perform all operations
    - This ensures bulk uploads and individual song additions work without authentication

  2. Security Note
    - This is a more permissive policy suitable for the current use case
    - In a production environment, you might want to add more restrictive policies
*/

-- Drop existing policies for songs table
DROP POLICY IF EXISTS "Allow public read access to songs" ON songs;
DROP POLICY IF EXISTS "Allow authenticated users to manage songs" ON songs;

-- Create new, more permissive policies for songs table
CREATE POLICY "Allow all operations on songs"
  ON songs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);