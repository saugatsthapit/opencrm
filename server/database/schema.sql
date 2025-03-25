-- Add interest_status column to call_tracking table
ALTER TABLE call_tracking ADD COLUMN IF NOT EXISTS interest_status VARCHAR(10) DEFAULT NULL; -- Values: 'green', 'yellow', 'red' 