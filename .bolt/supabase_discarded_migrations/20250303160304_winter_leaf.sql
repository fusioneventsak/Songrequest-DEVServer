-- Clear all existing data safely
DELETE FROM set_list_songs;
DELETE FROM set_lists;

-- Ensure no set lists are active
UPDATE set_lists SET is_active = false;