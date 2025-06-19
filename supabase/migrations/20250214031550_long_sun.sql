/*
  # Fix column name mismatch

  1. Changes
    - Rename album_art_url column to albumArtUrl in songs table to match TypeScript interface
*/

ALTER TABLE songs RENAME COLUMN album_art_url TO "albumArtUrl";