/*
  # Fix Storage Permissions

  1. Storage Setup
    - Ensure app_assets bucket exists with proper public access
    - Set proper RLS policies for the storage.objects table
    
  2. Security
    - Enable RLS on storage.objects table
    - Create separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
    - Properly configure policies for public access to app_assets bucket
*/

-- Create the storage bucket for app assets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('app_assets', 'app_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Read Access for app_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Uploads to app_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Updates to app_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Deletions in app_assets" ON storage.objects;

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
  USING (bucket_id = 'app_assets');

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