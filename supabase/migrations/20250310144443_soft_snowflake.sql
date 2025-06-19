/*
  # Fix requesters table for large photo payloads

  1. Changes
    - Modify requesters.photo column to support larger text content
    - Add text message length constraint for better performance

  2. Performance Considerations
    - By using TEXT type explicitly we ensure column can hold larger content
    - Adding length constraint to message field prevents abuse
*/

-- Update photo column to explicitly use TEXT type
ALTER TABLE requesters 
ALTER COLUMN photo TYPE TEXT;

-- Add constraint to limit message length 
ALTER TABLE requesters
ADD CONSTRAINT message_length_check
CHECK (char_length(message) <= 100);