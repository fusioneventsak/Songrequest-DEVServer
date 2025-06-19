/*
  # Create UI Settings Table and Storage Configuration

  1. New Tables
    - `ui_settings`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `band_logo_url` (text, nullable)
      - `band_name` (text, default: 'uRequest Live')
      - `primary_color` (text, default: '#ff00ff')
      - `secondary_color` (text, default: '#9d00ff')
  
  2. Functions
    - `update_updated_at_column()` - Updates the updated_at timestamp on record changes
  
  3. Triggers
    - Trigger to update the updated_at column when a record is updated
  
  4. Security
    - Enable RLS on `ui_settings` table
    - Allow public read access to settings
    - Allow authenticated users to manage settings
  
  5. Storage
    - Create app_assets bucket for logo storage
    - Set up storage access policies
*/

-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated to manage UI settings" ON public.ui_settings;
    DROP POLICY IF EXISTS "Allow public read access to UI settings" ON public.ui_settings;
    DROP POLICY IF EXISTS "Allow public access to app assets" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to upload assets" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to update assets" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to delete assets" ON storage.objects;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
    WHEN undefined_object THEN
        NULL;
END $$;

-- Create the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the ui_settings table
CREATE TABLE IF NOT EXISTS public.ui_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  band_logo_url text,
  band_name text DEFAULT 'uRequest Live',
  primary_color text DEFAULT '#ff00ff',
  secondary_color text DEFAULT '#9d00ff'
);

-- Enable row level security
ALTER TABLE public.ui_settings ENABLE ROW LEVEL SECURITY;

-- Create triggers for updating the updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_ui_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_ui_settings_updated_at
    BEFORE UPDATE ON public.ui_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- Create policies for access control
CREATE POLICY "Allow public read access to UI settings"
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

-- Insert default settings if none exist
INSERT INTO public.ui_settings (band_name, primary_color, secondary_color)
SELECT 'uRequest Live', '#ff00ff', '#9d00ff'
WHERE NOT EXISTS (SELECT 1 FROM public.ui_settings LIMIT 1);

-- Create a storage bucket for logo uploads if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('app_assets', 'app_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Allow public access to app assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app_assets');

CREATE POLICY "Allow authenticated users to upload assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app_assets');

CREATE POLICY "Allow authenticated users to update assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app_assets')
WITH CHECK (bucket_id = 'app_assets');

CREATE POLICY "Allow authenticated users to delete assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app_assets');