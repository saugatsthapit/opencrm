-- Add new columns to the call_tracking table for VAPI webhooks
ALTER TABLE IF EXISTS call_tracking
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS ended_reason TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS manual_entry BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add new columns to the call_conversations table
ALTER TABLE IF EXISTS call_conversations
ADD COLUMN IF NOT EXISTS messages JSONB;

-- Create indices for faster queries
CREATE INDEX IF NOT EXISTS idx_call_tracking_call_id ON call_tracking(call_id);
CREATE INDEX IF NOT EXISTS idx_call_tracking_lead_id ON call_tracking(lead_id); 