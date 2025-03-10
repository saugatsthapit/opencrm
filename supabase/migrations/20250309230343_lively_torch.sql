/*
  # Fix email tracking RLS policies

  1. Changes
    - Drop existing policies
    - Add new policies for email_tracking and email_link_clicks tables
    - Allow insert operations for authenticated users
    - Maintain secure read access

  2. Security
    - Enable RLS on both tables
    - Add policies for insert and select operations
    - Ensure users can only access their own data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own email tracking" ON email_tracking;
DROP POLICY IF EXISTS "Users can view their own link clicks" ON email_link_clicks;

-- Add new policies for email_tracking
CREATE POLICY "Enable insert for authenticated users"
  ON email_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable select for users own tracking data"
  ON email_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM lead_sequences ls
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE ls.id = email_tracking.lead_sequence_id
      AND s.user_id = auth.uid()
    )
  );

-- Add new policies for email_link_clicks
CREATE POLICY "Enable insert for authenticated users"
  ON email_link_clicks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable select for users own click data"
  ON email_link_clicks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM email_tracking et
      JOIN lead_sequences ls ON ls.id = et.lead_sequence_id
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE et.id = email_link_clicks.email_tracking_id
      AND s.user_id = auth.uid()
    )
  );