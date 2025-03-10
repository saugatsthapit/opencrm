/*
  # Add email tracking functionality

  1. New Tables
    - `email_tracking`
      - `id` (uuid, primary key)
      - `lead_sequence_id` (uuid, references lead_sequences)
      - `step_id` (uuid, references sequence_steps)
      - `email` (text)
      - `subject` (text)
      - `sent_at` (timestamp)
      - `opened_at` (timestamp)
      - `bounced_at` (timestamp)
      - `bounce_reason` (text)
      - `tracking_id` (uuid, unique)
      
    - `email_link_clicks`
      - `id` (uuid, primary key)
      - `email_tracking_id` (uuid, references email_tracking)
      - `url` (text)
      - `clicked_at` (timestamp)
      - `user_agent` (text)
      - `ip_address` (text)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- Create email_tracking table
CREATE TABLE IF NOT EXISTS email_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_sequence_id uuid REFERENCES lead_sequences(id) ON DELETE CASCADE,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE CASCADE,
  email text NOT NULL,
  subject text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  bounced_at timestamptz,
  bounce_reason text,
  tracking_id uuid UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- Create email_link_clicks table
CREATE TABLE IF NOT EXISTS email_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_tracking_id uuid REFERENCES email_tracking(id) ON DELETE CASCADE,
  url text NOT NULL,
  clicked_at timestamptz DEFAULT now(),
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_link_clicks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own email tracking"
  ON email_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_sequences ls
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE ls.id = email_tracking.lead_sequence_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own link clicks"
  ON email_link_clicks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_tracking et
      JOIN lead_sequences ls ON ls.id = et.lead_sequence_id
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE et.id = email_link_clicks.email_tracking_id
      AND s.user_id = auth.uid()
    )
  );