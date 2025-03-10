/*
  # Update RLS policies for leads table

  1. Changes
    - Drop existing RLS policy that requires authentication
    - Add new policy to allow public access for all operations
    
  2. Security
    - Enable public access to leads table since authentication is not required
    - Allow all operations (SELECT, INSERT, UPDATE, DELETE) without restrictions
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;

-- Create new policy for public access
CREATE POLICY "Allow public access to leads"
ON leads
FOR ALL
TO public
USING (true)
WITH CHECK (true);