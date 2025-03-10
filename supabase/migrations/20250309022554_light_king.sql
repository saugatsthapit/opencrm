/*
  # Add wait time configuration to sequence steps

  1. Changes
    - Add wait_time column to sequence_steps table for storing the duration
    - Add wait_time_unit column to sequence_steps table for storing the unit (minutes, hours, days)
    - Set default wait time unit to 'days'

  2. Notes
    - Supports minutes, hours, and days as wait time units
    - Default wait time unit is 'days' for backward compatibility
*/

-- Add new columns for wait time configuration
ALTER TABLE sequence_steps 
ADD COLUMN IF NOT EXISTS wait_time INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS wait_time_unit TEXT CHECK (wait_time_unit IN ('minutes', 'hours', 'days')) DEFAULT 'days';

-- Add comment to explain the wait time configuration
COMMENT ON COLUMN sequence_steps.wait_time IS 'The duration to wait before executing the step';
COMMENT ON COLUMN sequence_steps.wait_time_unit IS 'The unit of time for the wait duration (minutes, hours, days)';