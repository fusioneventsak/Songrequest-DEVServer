/*
  # Fix requesters table Row Level Security policies

  1. Security
    - Add comprehensive RLS policies for the requesters table
    - Allow public users to insert, update, and delete records
    - Ensure consistent policy coverage for all operations
*/

-- First ensure RLS is enabled
ALTER TABLE public.requesters ENABLE ROW LEVEL SECURITY;

-- Create a comprehensive public policy for all operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' 
    AND policyname = 'Public full access to requesters'
  ) THEN
    CREATE POLICY "Public full access to requesters"
      ON public.requesters
      FOR ALL
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Just to be extra safe, create explicit policies for each operation
-- Insert policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' 
    AND policyname = 'Public insert access to requesters'
  ) THEN
    CREATE POLICY "Public insert access to requesters"
      ON public.requesters
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END $$;

-- Update policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' 
    AND policyname = 'Public update access to requesters'
  ) THEN
    CREATE POLICY "Public update access to requesters"
      ON public.requesters
      FOR UPDATE
      TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Delete policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'requesters' 
    AND policyname = 'Public delete access to requesters'
  ) THEN
    CREATE POLICY "Public delete access to requesters"
      ON public.requesters
      FOR DELETE
      TO public
      USING (true);
  END IF;
END $$;