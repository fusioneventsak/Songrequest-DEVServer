/*
  # Set up storage for band logos

  1. New Storage Bucket
    - Create a public bucket for storing band logos and UI assets
    - Set RLS policies for public access
  
  2. Storage Organization
    - Logos will be stored in the `logos` folder
*/

-- Create a storage bucket for public assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('app_assets', 'app_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set RLS policies for the app_assets bucket
CREATE POLICY "Public Access to App Assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app_assets');

CREATE POLICY "Allow Authenticated Users to Upload App Assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app_assets');

-- Allow public to download and view public assets
CREATE POLICY "Public Downloads of App Assets"
ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'app_assets');

-- Create a new table to store UI configuration including the logo URL
CREATE TABLE IF NOT EXISTS public.ui_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  band_logo_url text,
  band_name text DEFAULT 'uRequest Live',
  primary_color text DEFAULT '#ff00ff',
  secondary_color text DEFAULT '#9d00ff'
);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now(); 
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ui_settings_updated_at
BEFORE UPDATE ON public.ui_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add policies for UI settings
ALTER TABLE public.ui_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public to read UI settings"
ON public.ui_settings
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated to manage UI settings"
ON public.ui_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert default UI settings
INSERT INTO public.ui_settings (band_name, band_logo_url)
VALUES ('uRequest Live', NULL)
ON CONFLICT DO NOTHING;