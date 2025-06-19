/*
  # Fix Queue Reset Logs RLS Policies

  1. Changes
    - Add RLS policy to allow public users to insert queue reset logs
    - Keep existing read policy
    - Add index for better performance
*/

-- Add policy for public insert access to queue reset logs
CREATE POLICY "Allow public to insert queue reset logs"
    ON queue_reset_logs
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_queue_reset_logs_created_at 
    ON queue_reset_logs(created_at DESC);

-- Add index for set list lookups
CREATE INDEX IF NOT EXISTS idx_queue_reset_logs_set_list_id 
    ON queue_reset_logs(set_list_id);