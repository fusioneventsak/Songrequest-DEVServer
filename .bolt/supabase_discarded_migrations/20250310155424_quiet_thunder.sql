/*
  # Add storage bucket and UI settings

  1. New Storage
    - Create "app_assets" storage bucket for logos with public access
  
  2. UI Settings
    - Ensure the ui_settings table has at least one row for app configuration
*/

-- Create storage bucket if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'app_assets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('app_assets', 'app_assets', true);
  END IF;
END $$;

-- Storage buckets need public policy for anonymous access
-- We'll set it up using the appropriate RLS mechanism for storage
DO $$
BEGIN
  -- Create a policy for the bucket if needed (using storage API)
  EXECUTE format('
    CREATE POLICY "Public Read Access" ON storage.objects
    FOR SELECT
    USING (bucket_id = ''app_assets'' AND auth.role() = ''anon'')
  ');
EXCEPTION
  WHEN duplicate_object THEN
    -- Policy might already exist, which is fine
    NULL;
END $$;

-- Ensure the ui_settings table has at least one row
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ui_settings LIMIT 1) THEN
    INSERT INTO public.ui_settings (band_name, primary_color, secondary_color)
    VALUES ('uRequest Live', '#ff00ff', '#9d00ff');
  END IF;
END $$;