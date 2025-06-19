/*
  # Create realtime connection logs table

  1. New Tables
    - `realtime_connection_logs`
      - `id` (uuid, primary key)
      - `status` (text, connection status)
      - `client_id` (text, unique client identifier)
      - `error_message` (text, nullable, error details if any)
      - `created_at` (timestamp with time zone, default now())

  2. Security
    - Enable RLS on `realtime_connection_logs` table
    - Add policy for public access to allow connection logging
*/

CREATE TABLE IF NOT EXISTS realtime_connection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  client_id text NOT NULL,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE realtime_connection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Realtime connection logs public access"
  ON realtime_connection_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_realtime_connection_logs_client_id 
  ON realtime_connection_logs (client_id);

CREATE INDEX IF NOT EXISTS idx_realtime_connection_logs_created_at 
  ON realtime_connection_logs (created_at DESC);