/*
  # Fix set list activation issues
  
  1. Changes
     - Safely clear set list data without disabling system triggers
     - Reset active status for all set lists
*/

-- Clear all set list data safely
DELETE FROM set_list_songs;
DELETE FROM set_lists;

-- Ensure no set lists are active
UPDATE set_lists SET is_active = false;