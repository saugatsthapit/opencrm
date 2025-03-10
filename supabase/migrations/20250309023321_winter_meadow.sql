/*
  # Add wait time configuration

  1. Changes
    - Add wait_time column to store the duration value
    - Add wait_time_unit column to store the unit (minutes, hours, days)
    - Set default values for existing records
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add new columns for wait time configuration
ALTER TABLE sequence_steps 
ADD COLUMN IF NOT EXISTS wait_time INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS wait_time_unit TEXT DEFAULT 'days'::text
  CHECK (wait_time_unit IN ('minutes', 'hours', 'days'));

-- Set default values for existing records
UPDATE sequence_steps
SET 
  wait_time = 1,
  wait_time_unit = 'days'
WHERE wait_time IS NULL;