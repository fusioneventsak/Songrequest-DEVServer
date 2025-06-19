/*
  # Fix Multiple Permissive Policies and Duplicate Indexes
  
  1. Changes
    - Consolidate multiple RLS policies for photos table
    - Consolidate multiple RLS policies for requesters table
    - Consolidate multiple RLS policies for requests table
    - Consolidate multiple RLS policies for settings table
    - Consolidate multiple RLS policies for songs table
    - Remove duplicate index on set_lists table
    
  2. Performance Improvements
    - Improve query performance by removing redundant policy evaluations
    - Reduce storage space by eliminating duplicate indexes
    - Maintain exact same security permissions
*/

-- Drop duplicate index on set_lists table
DROP INDEX IF EXISTS idx_set_lists_active;

-- Fix multiple permissive policies on photos table
-- First, drop all existing policies
DROP POLICY IF EXISTS "Allow authenticated users to insert photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public read access to public photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public read access to video content" ON public.photos;
DROP POLICY IF EXISTS "Allow public to create photos" ON public.photos;
DROP POLICY IF EXISTS "Allow public to update their photos" ON public.photos;
DROP POLICY IF EXISTS "Enable delete for public" ON public.photos;
DROP POLICY IF EXISTS "Enable insert for public" ON public.photos;
DROP POLICY IF EXISTS "Enable select for public photos" ON public.photos;
DROP POLICY IF EXISTS "Enable update for public" ON public.photos;

-- Create a single consolidated policy for each operation
CREATE POLICY "Photos INSERT policy" ON public.photos
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Photos SELECT policy" ON public.photos
  FOR SELECT TO public
  USING (public = true);

CREATE POLICY "Photos UPDATE policy" ON public.photos
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Photos DELETE policy" ON public.photos
  FOR DELETE TO public
  USING (true);

-- Fix multiple permissive policies on requesters table
-- First, drop all existing policies
DROP POLICY IF EXISTS "Allow public read access to requesters" ON public.requesters;
DROP POLICY IF EXISTS "Enable realtime for all users" ON public.requesters;
DROP POLICY IF EXISTS "Public delete access to requesters" ON public.requesters;
DROP POLICY IF EXISTS "Public full access to requesters" ON public.requesters;
DROP POLICY IF EXISTS "Public insert access to requesters" ON public.requesters;
DROP POLICY IF EXISTS "Public read access to requesters" ON public.requesters;
DROP POLICY IF EXISTS "Public update access to requesters" ON public.requesters;
DROP POLICY IF EXISTS "ALL" ON public.requesters;

-- Create a single consolidated policy for each operation
CREATE POLICY "Requesters SELECT policy" ON public.requesters
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Requesters INSERT policy" ON public.requesters
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Requesters UPDATE policy" ON public.requesters
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Requesters DELETE policy" ON public.requesters
  FOR DELETE TO public
  USING (true);

-- Fix multiple permissive policies on requests table
-- First, drop all existing policies
DROP POLICY IF EXISTS "Optimized read policy for public requests" ON public.requests;
DROP POLICY IF EXISTS "Public read access to requests" ON public.requests;
DROP POLICY IF EXISTS "Public insert access to requests" ON public.requests;
DROP POLICY IF EXISTS "Public update access to requests" ON public.requests;
DROP POLICY IF EXISTS "Public delete access to requests" ON public.requests;

-- Create a single consolidated policy for each operation
CREATE POLICY "Requests SELECT policy" ON public.requests
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Requests INSERT policy" ON public.requests
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Requests UPDATE policy" ON public.requests
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Requests DELETE policy" ON public.requests
  FOR DELETE TO public
  USING (true);

-- Fix multiple permissive policies on settings table
-- First, drop all existing policies
DROP POLICY IF EXISTS "Allow public read access to settings" ON public.settings;
DROP POLICY IF EXISTS "Allow public to manage settings" ON public.settings;

-- Create a single consolidated policy for each operation
CREATE POLICY "Settings SELECT policy" ON public.settings
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Settings ALL policy" ON public.settings
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);

-- Fix multiple permissive policies on songs table
-- First, drop all existing policies
DROP POLICY IF EXISTS "Enable realtime for all users" ON public.songs;
DROP POLICY IF EXISTS "Optimized read policy for songs" ON public.songs;
DROP POLICY IF EXISTS "Public read access to songs" ON public.songs;
DROP POLICY IF EXISTS "Public delete access to songs" ON public.songs;
DROP POLICY IF EXISTS "Public insert access to songs" ON public.songs;
DROP POLICY IF EXISTS "Public update access to songs" ON public.songs;

-- Create a single consolidated policy for each operation
CREATE POLICY "Songs SELECT policy" ON public.songs
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Songs INSERT policy" ON public.songs
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Songs UPDATE policy" ON public.songs
  FOR UPDATE TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Songs DELETE policy" ON public.songs
  FOR DELETE TO public
  USING (true);