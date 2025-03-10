/*
  # Update RLS policies for public access

  1. Changes
    - Remove user-specific RLS policies
    - Add public access policies for all tables
    - Enable RLS but allow public access

  2. Security
    - Allow public access to all operations
    - Keep RLS enabled for future auth implementation
*/

-- Update sequences table policies
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own sequences" ON sequences;
DROP POLICY IF EXISTS "Users can view their own sequences" ON sequences;
DROP POLICY IF EXISTS "Users can update their own sequences" ON sequences;
DROP POLICY IF EXISTS "Users can delete their own sequences" ON sequences;

CREATE POLICY "Allow public access to sequences"
ON sequences FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Update sequence_steps table policies
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage sequence steps" ON sequence_steps;

CREATE POLICY "Allow public access to sequence steps"
ON sequence_steps FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Update lead_sequences table policies
ALTER TABLE lead_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to lead sequences"
ON lead_sequences FOR ALL
TO public
USING (true)
WITH CHECK (true);