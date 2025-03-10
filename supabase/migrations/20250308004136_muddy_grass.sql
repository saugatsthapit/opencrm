/*
  # Update leads table RLS policies

  1. Changes
    - Add RLS policy for inserting leads with user_id
    - Update existing RLS policy to handle all operations

  2. Security
    - Enable RLS on leads table
    - Add policy for authenticated users to manage their own leads
*/

-- Update the RLS policy for the leads table
DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;

CREATE POLICY "Users can manage their own leads"
ON leads
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);