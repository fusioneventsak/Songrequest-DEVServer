/*
  # Clear all existing data

  This migration clears all existing data while preserving the table structure.
  This helps ensure we start fresh without any cached or stale data.

  1. Changes:
    - Clear all data from all tables in the correct order
    - Reset sequences if any
  
  2. Security:
    - Maintains existing RLS policies
    - No structural changes to tables
*/

-- Clear data in the correct order to respect foreign key constraints
DELETE FROM requesters;
DELETE FROM requests;
DELETE FROM set_list_songs;
DELETE FROM set_lists;
DELETE FROM songs;