/*
  # Add sequence versioning

  1. Changes
    - Add version column to sequences table to track changes
    - Add version column to lead_sequences table to track which version a lead is following
    - Add executed_steps column to lead_sequences to track which steps have been executed
  
  2. Security
    - Maintain existing RLS policies
*/

-- Add version tracking to sequences
ALTER TABLE sequences 
ADD COLUMN version INTEGER DEFAULT 1;

-- Add version tracking to lead_sequences
ALTER TABLE lead_sequences 
ADD COLUMN sequence_version INTEGER DEFAULT 1,
ADD COLUMN executed_steps INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Update existing records
UPDATE sequences SET version = 1 WHERE version IS NULL;
UPDATE lead_sequences SET sequence_version = 1 WHERE sequence_version IS NULL;