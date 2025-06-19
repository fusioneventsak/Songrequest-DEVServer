/*
  # Fix Storage Access Policies

  1. Security
    - Create the app_assets storage bucket if it doesn't exist
    - Enable RLS on storage.objects table
    - Add policies for public read access to the app_assets bucket
    - Add policies for public insert/update/delete access to the app_assets bucket

  2. Data
    - Ensure ui_settings table has at least one row with default values
*/

-- Create the storage bucket for app assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('app_assets', 'app_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public access to read objects from the app_assets bucket
CREATE POLICY "Public Read Access for app_assets"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'app_assets');

-- Allow public users to upload objects to the app_assets bucket
CREATE POLICY "Allow Public Uploads to app_assets"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'app_assets');

-- Allow public users to update objects in the app_assets bucket
CREATE POLICY "Allow Public Updates to app_assets"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'app_assets')
  WITH CHECK (bucket_id = 'app_assets');

-- Allow public users to delete objects in the app_assets bucket
CREATE POLICY "Allow Public Deletions in app_assets"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'app_assets');

-- Ensure we have at least one row in the ui_settings table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ui_settings LIMIT 1) THEN
    INSERT INTO public.ui_settings (band_name, primary_color, secondary_color)
    VALUES ('uRequest Live', '#ff00ff', '#9d00ff');
  END IF;
END $$;