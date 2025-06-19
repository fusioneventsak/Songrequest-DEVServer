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
      - `albumArtUrl` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `requests`
      - `id` (uuid, primary key)
      - `title` (text)
      - `artist` (text)
      - `votes` (integer)
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

    - `user_votes`
      - `id` (uuid, primary key)
      - `request_id` (uuid, foreign key)
      - `user_id` (text)
      - `created_at` (timestamp)

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

    - `ui_settings`
      - `id` (uuid, primary key)
      - `band_name` (text)
      - `band_logo_url` (text)
      - `frontend_accent_color` (text)
      - `frontend_header_bg` (text)
      - `nav_bg_color` (text)
      - `highlight_color` (text)
      - `song_border_color` (text)
      - `frontend_secondary_accent` (text)
      - `custom_message` (text)
      - `show_qr_code` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for public access to all tables
*/

-- Create songs table
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  genre text,
  key text,
  notes text,
  "albumArtUrl" text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create requests table
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  votes integer DEFAULT 0,
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
  created_at timestamptz DEFAULT now(),
  CONSTRAINT message_length_check CHECK (char_length(message) <= 100)
);

-- Create user_votes table
CREATE TABLE IF NOT EXISTS user_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(request_id, user_id)
);

-- Create set_lists table
CREATE TABLE IF NOT EXISTS set_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'New Set List',
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
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

-- Create ui_settings table
CREATE TABLE IF NOT EXISTS ui_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_name text DEFAULT 'Band Request Hub',
  band_logo_url text,
  frontend_accent_color text DEFAULT '#ff00ff',
  frontend_header_bg text DEFAULT '#13091f',
  nav_bg_color text DEFAULT '#0f051d',
  highlight_color text DEFAULT '#ff00ff',
  song_border_color text DEFAULT '#ff00ff',
  frontend_secondary_accent text DEFAULT '#9d00ff',
  custom_message text DEFAULT '',
  show_qr_code boolean DEFAULT true,
  ticker_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for songs table
CREATE TRIGGER update_songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for ui_settings table
CREATE TRIGGER update_ui_settings_updated_at
  BEFORE UPDATE ON ui_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle set list activation
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

-- Create trigger for set list activation
CREATE TRIGGER handle_set_list_activation_trigger
  BEFORE UPDATE ON set_lists
  FOR EACH ROW
  WHEN (NEW.is_active IS DISTINCT FROM OLD.is_active)
  EXECUTE FUNCTION handle_set_list_activation();

-- Create function for atomic lock operations
CREATE OR REPLACE FUNCTION lock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First, unlock all requests
  UPDATE requests 
  SET is_locked = false 
  WHERE is_locked = true;
  
  -- Then lock the specified request
  UPDATE requests 
  SET is_locked = true 
  WHERE id = request_id;
END;
$$;

-- Create function to unlock a request
CREATE OR REPLACE FUNCTION unlock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simply unlock the specified request
  UPDATE requests 
  SET is_locked = false 
  WHERE id = request_id;
END;
$$;

-- Create function for atomic vote operations
CREATE OR REPLACE FUNCTION add_vote(p_request_id UUID, p_user_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vote_exists BOOLEAN;
BEGIN
  -- Check if vote already exists
  SELECT EXISTS(
    SELECT 1 FROM user_votes 
    WHERE request_id = p_request_id AND user_id = p_user_id
  ) INTO vote_exists;
  
  IF vote_exists THEN
    RETURN FALSE; -- Already voted
  END IF;
  
  -- Insert vote and increment counter atomically
  BEGIN
    INSERT INTO user_votes (request_id, user_id, created_at) 
    VALUES (p_request_id, p_user_id, NOW());
    
    UPDATE requests 
    SET votes = COALESCE(votes, 0) + 1 
    WHERE id = p_request_id;
    
    RETURN TRUE; -- Success
  EXCEPTION WHEN OTHERS THEN
    -- Handle any constraint violations or errors
    RETURN FALSE;
  END;
END;
$$;

-- Enable Row Level Security
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE requesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_list_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for songs
CREATE POLICY "Songs public access"
  ON songs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies for requests
CREATE POLICY "Requests public access"
  ON requests
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies for requesters
CREATE POLICY "Requesters public access"
  ON requesters
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies for user_votes
CREATE POLICY "User votes public access"
  ON user_votes
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies for set_lists
CREATE POLICY "Set lists public access"
  ON set_lists
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies for set_list_songs
CREATE POLICY "Set list songs public access"
  ON set_list_songs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create policies for ui_settings
CREATE POLICY "UI settings public access"
  ON ui_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create performance indexes
CREATE INDEX idx_requests_is_locked ON requests(is_locked) WHERE is_locked = true;
CREATE INDEX idx_requests_is_played ON requests(is_played);
CREATE INDEX idx_requests_title_artist ON requests(title, artist);
CREATE INDEX idx_requests_priority ON requests(votes DESC, created_at) WHERE is_played = false;
CREATE INDEX idx_requesters_request_id ON requesters(request_id);
CREATE INDEX idx_user_votes_lookup ON user_votes(request_id, user_id);
CREATE INDEX idx_set_lists_is_active ON set_lists(is_active) WHERE is_active = true;
CREATE INDEX idx_set_list_songs_set_list_id ON set_list_songs(set_list_id);
CREATE INDEX idx_set_list_songs_song_id ON set_list_songs(song_id);

-- Insert default UI settings
INSERT INTO ui_settings (
  band_name,
  frontend_accent_color,
  frontend_header_bg,
  nav_bg_color,
  highlight_color,
  song_border_color,
  frontend_secondary_accent
) VALUES (
  'Band Request Hub',
  '#ff00ff',
  '#13091f',
  '#0f051d',
  '#ff00ff',
  '#ff00ff',
  '#9d00ff'
) ON CONFLICT DO NOTHING;