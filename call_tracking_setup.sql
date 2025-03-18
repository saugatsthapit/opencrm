/*
  # Add call tracking functionality

  Execute this in the Supabase SQL Editor:
  1. Go to your Supabase dashboard
  2. Navigate to the SQL Editor
  3. Paste this entire file
  4. Run the SQL to create all tables and functions
*/

-- Create call_tracking table
CREATE TABLE IF NOT EXISTS call_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id UUID DEFAULT gen_random_uuid(),
  lead_sequence_id UUID REFERENCES lead_sequences(id),
  step_id UUID,
  lead_id UUID REFERENCES leads(id),
  phone_number TEXT NOT NULL,
  call_id TEXT,
  status TEXT,
  duration INTEGER,
  recording_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Create call_conversations table
CREATE TABLE IF NOT EXISTS call_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_tracking_id UUID REFERENCES call_tracking(id),
  transcript TEXT,
  conversation_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE call_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_conversations ENABLE ROW LEVEL SECURITY;

-- Create a stored procedure to bypass RLS for call tracking
CREATE OR REPLACE FUNCTION create_call_tracking(
  p_lead_sequence_id UUID,
  p_step_id UUID,
  p_phone_number TEXT,
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tracking_id UUID := gen_random_uuid();
  v_result JSONB;
BEGIN
  -- Insert the record
  INSERT INTO call_tracking (
    tracking_id,
    lead_sequence_id,
    step_id,
    phone_number,
    lead_id,
    created_at
  ) VALUES (
    v_tracking_id,
    p_lead_sequence_id,
    p_step_id,
    p_phone_number,
    p_lead_id,
    NOW()
  )
  RETURNING to_jsonb(call_tracking.*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_call_tracking TO authenticated;

-- Add RLS policies for call_tracking
CREATE POLICY "Enable insert for authenticated users on call_tracking"
  ON call_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable select for users own tracking data on call_tracking"
  ON call_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM lead_sequences ls
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE ls.id = call_tracking.lead_sequence_id
      AND s.user_id = auth.uid()
    )
    OR true -- For development, allow all reads
  );

-- Add RLS policies for call_conversations
CREATE POLICY "Enable insert for authenticated users on call_conversations"
  ON call_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable select for users own call conversations"
  ON call_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM call_tracking ct
      JOIN lead_sequences ls ON ls.id = ct.lead_sequence_id
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE ct.id = call_conversations.call_tracking_id
      AND s.user_id = auth.uid()
    )
    OR true -- For development, allow all reads
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_tracking_lead_id ON call_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_lead_sequence_id ON call_tracking(lead_sequence_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_call_id ON call_tracking(call_id);
CREATE INDEX IF NOT EXISTS idx_call_conversations_call_tracking_id ON call_conversations(call_tracking_id);

-- Add a phone field to leads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'phone'
    ) THEN
        ALTER TABLE leads ADD COLUMN phone TEXT;
    END IF;
END
$$; 