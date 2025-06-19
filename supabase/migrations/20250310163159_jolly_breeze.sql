/*
  # UI Settings Table and Security Policies

  1. New Tables
    - `ui_settings` table for storing application UI configuration
      - `id` (uuid, primary key)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
      - `band_logo_url` (text, nullable)
      - `band_name` (text, default: 'uRequest Live')
      - `primary_color` (text, default: '#ff00ff')
      - `secondary_color` (text, default: '#9d00ff')
  
  2. Security
    - Enable row level security on the `ui_settings` table
    - Add policy for public read access
    - Add policy for authenticated users to manage settings
  
  3. Functions and Triggers
    - Create update_updated_at_column function for timestamp management
    - Add trigger to automatically update the updated_at timestamp
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

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating the updated_at column if it doesn't exist
DO $$
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT FROM pg_trigger 
        WHERE tgname = 'update_ui_settings_updated_at'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER update_ui_settings_updated_at
        BEFORE UPDATE ON public.ui_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- Create the public read policy if it doesn't exist
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT FROM pg_policies 
        WHERE tablename = 'ui_settings' 
        AND policyname = 'Allow public to read UI settings'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        CREATE POLICY "Allow public to read UI settings"
        ON public.ui_settings
        FOR SELECT
        TO public
        USING (true);
    END IF;
END
$$;

-- Create the authenticated management policy if it doesn't exist
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT FROM pg_policies 
        WHERE tablename = 'ui_settings' 
        AND policyname = 'Allow authenticated to manage UI settings'
    ) INTO policy_exists;
    
    IF NOT policy_exists THEN
        CREATE POLICY "Allow authenticated to manage UI settings"
        ON public.ui_settings
        FOR ALL
        TO authenticated
        USING (true);
    END IF;
END
$$;

-- Add a default row if none exists
DO $$
DECLARE
    row_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO row_count FROM public.ui_settings;
    
    IF row_count = 0 THEN
        INSERT INTO public.ui_settings (
            band_name, 
            primary_color, 
            secondary_color
        ) VALUES (
            'uRequest Live', 
            '#ff00ff', 
            '#9d00ff'
        );
    END IF;
END
$$;