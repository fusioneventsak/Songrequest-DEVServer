/*
  # Database Performance Optimizations
  
  1. Add Missing Indexes
    - Create indexes for unindexed foreign keys
    - This improves join performance
    
  2. Remove Unused Indexes
    - Clean up indexes that aren't being used
    - This reduces database size and improves maintenance operations
  
  3. Overall Benefits
    - Faster query performance
    - Reduced database size
    - Improved maintenance efficiency
*/

-- Add indexes for unindexed foreign keys
CREATE INDEX IF NOT EXISTS idx_activation_logs_set_list_id 
  ON public.activation_logs(set_list_id);

CREATE INDEX IF NOT EXISTS idx_set_list_songs_song_id 
  ON public.set_list_songs(song_id);

-- Remove unused indexes (keeping those that might be used in the future)
DROP INDEX IF EXISTS idx_requests_locked;
DROP INDEX IF EXISTS idx_recent_requests;
DROP INDEX IF EXISTS idx_photos_content_type;

-- We'll keep some important indexes even if they're not currently used
-- as they're critical for application functionality:
-- - idx_queue_reset_logs_created_at (important for time-based lookups)
-- - idx_activation_logs_created_at (important for time-based lookups)
-- - idx_set_lists_is_active (critical for set list activation feature)

-- Remove duplicate index (idx_set_lists_active was identified as a duplicate of idx_set_lists_is_active)
DROP INDEX IF EXISTS idx_set_lists_active;