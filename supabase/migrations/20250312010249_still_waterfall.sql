/*
  # Fix Foreign Key Constraints for Queue Reset Logs

  1. Changes
    - Add cascade delete to queue_reset_logs foreign key
    - Ensure proper error handling for deletions
    - Add index for better performance
*/

-- First clean up any orphaned records
DELETE FROM queue_reset_logs
WHERE set_list_id IS NOT NULL 
  AND set_list_id NOT IN (SELECT id FROM set_lists);

-- Drop and recreate foreign key constraints with cascade delete
ALTER TABLE queue_reset_logs 
DROP CONSTRAINT IF EXISTS queue_reset_logs_set_list_id_fkey;

ALTER TABLE queue_reset_logs
ADD CONSTRAINT queue_reset_logs_set_list_id_fkey 
FOREIGN KEY (set_list_id) 
REFERENCES set_lists(id) 
ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_reset_logs_set_list_id 
    ON queue_reset_logs(set_list_id);