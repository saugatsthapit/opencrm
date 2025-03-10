/*
  # Add RLS policies for sequences table

  1. Security Changes
    - Enable RLS on sequences table
    - Add policies for authenticated users to:
      - Create their own sequences
      - Read their own sequences
      - Update their own sequences
      - Delete their own sequences
    
  Note: Skipping sequence_steps RLS setup as it already exists
*/

-- Enable RLS on sequences table if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'sequences' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can create their own sequences" ON sequences;
  DROP POLICY IF EXISTS "Users can view their own sequences" ON sequences;
  DROP POLICY IF EXISTS "Users can update their own sequences" ON sequences;
  DROP POLICY IF EXISTS "Users can delete their own sequences" ON sequences;
END $$;

-- Create new policies
CREATE POLICY "Users can create their own sequences"
ON sequences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sequences"
ON sequences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sequences"
ON sequences
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sequences"
ON sequences
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);