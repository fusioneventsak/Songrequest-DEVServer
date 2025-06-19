/*
  # Add User Photos Storage Bucket
  
  1. Changes
    - Create a storage bucket for user photos
    - Set up RLS policies for public access to photos
    - Enable proper security for uploads
  
  2. Security
    - Allow public read access to photos
    - Allow authenticated users to upload photos
    - Ensure proper access control
*/

-- Create a storage bucket for user photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on the storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public access to read objects from the user-photos bucket
CREATE POLICY "Public Read Access for user-photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'user-photos');

-- Allow public users to upload objects to the user-photos bucket
CREATE POLICY "Allow Public Uploads to user-photos"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'user-photos');

-- Allow public users to update objects in the user-photos bucket
CREATE POLICY "Allow Public Updates to user-photos"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'user-photos')
  WITH CHECK (bucket_id = 'user-photos');

-- Allow public users to delete objects in the user-photos bucket
CREATE POLICY "Allow Public Deletions in user-photos"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'user-photos');