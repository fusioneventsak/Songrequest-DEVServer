/*
  # Initial Schema Setup for Band Request Hub

  1. New Tables
    - `songs`
      - `id` (uuid, primary key)
      - `title` (text)
      - `artist` (text)
      - `genre` (text)
      - `key` (text)
      - `notes` (text)
      - `album_art_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `set_lists`
      - `id` (uuid, primary key)
      - `name` (text)
      - `date` (date)
      - `notes` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)

    - `set_list_songs`
      - `id` (uuid, primary key)
      - `set_list_id` (uuid, foreign key)
      - `song_id` (uuid, foreign key)
      - `position` (integer)
      - `created_at` (timestamp)

    - `requests`
      - `id` (uuid, primary key)
      - `title` (text)
      - `artist` (text)
      - `votes` (integer)
      - `status` (text)
      - `is_locked` (boolean)
      - `is_played` (boolean)
      - `created_at` (timestamp)

    - `requesters`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key)
      - `name` (text)
      - `photo` (text)
      - `message` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read/write data
*/

-- Create songs table
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  genre text,
  key text,
  notes text,
  album_art_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create set_lists table
CREATE TABLE IF NOT EXISTS set_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  notes text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create set_list_songs table
CREATE TABLE IF NOT EXISTS set_list_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_list_id uuid REFERENCES set_lists(id) ON DELETE CASCADE,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  votes integer DEFAULT 0,
  status text DEFAULT 'pending',
  is_locked boolean DEFAULT false,
  is_played boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create requesters table
CREATE TABLE IF NOT EXISTS requesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo text NOT NULL,
  message text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_list_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE requesters ENABLE ROW LEVEL SECURITY;

-- Create policies for songs
CREATE POLICY "Allow public read access to songs"
  ON songs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to manage songs"
  ON songs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for set_lists
CREATE POLICY "Allow public read access to set_lists"
  ON set_lists FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to manage set_lists"
  ON set_lists FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for set_list_songs
CREATE POLICY "Allow public read access to set_list_songs"
  ON set_list_songs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to manage set_list_songs"
  ON set_list_songs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for requests
CREATE POLICY "Allow public read access to requests"
  ON requests FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to manage requests"
  ON requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for requesters
CREATE POLICY "Allow public read access to requesters"
  ON requesters FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to manage requesters"
  ON requesters FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for songs table
CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();