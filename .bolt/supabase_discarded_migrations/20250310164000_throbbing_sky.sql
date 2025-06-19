/*
  # Create UI Settings Table

  1. New Tables
    - `ui_settings` (if not exists)
      - `id` (uuid, primary key)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
      - `band_logo_url` (text, nullable)
      - `band_name` (text, default 'uRequest Live')
      - `primary_color` (text, default '#ff00ff')
      - `secondary_color` (text, default '#9d00ff')
  2. Security
    - Enable RLS on `ui_settings` table
    - Add policies for public read and authenticated management
  3. Functions and Triggers
    - Check for existing trigger before creating
    - Add policies with existence checks
*/

-- Create UI settings table if it doesn't exist
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

-- Create the update_updated_at_column function - this uses OR REPLACE so it's safe
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if trigger exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_ui_settings_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER update_ui_settings_updated_at
    BEFORE UPDATE ON public.ui_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END
$$;

-- Check if public read policy exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ui_settings' 
    AND policyname = 'Allow public to read UI settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow public to read UI settings"
    ON public.ui_settings
    FOR SELECT
    TO public
    USING (true)';
  END IF;
END
$$;

-- Check if authenticated management policy exists before creating it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ui_settings' 
    AND policyname = 'Allow authenticated to manage UI settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated to manage UI settings"
    ON public.ui_settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true)';
  END IF;
END
$$;

-- Insert default settings if none exist
INSERT INTO public.ui_settings (band_name, primary_color, secondary_color)
SELECT 'uRequest Live', '#ff00ff', '#9d00ff'
WHERE NOT EXISTS (SELECT 1 FROM public.ui_settings LIMIT 1);