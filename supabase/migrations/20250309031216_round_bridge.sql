/*
  # Add email tracking fields

  1. Changes
    - Add `next_execution` column to `lead_sequences` table to track when the next step should be executed
    - Add `last_executed` column to `lead_sequences` table to track when the last step was executed
    - Add `error_message` column to `lead_sequences` table to store any error messages

  2. Security
    - Maintain existing RLS policies
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_sequences' AND column_name = 'next_execution'
  ) THEN
    ALTER TABLE lead_sequences 
    ADD COLUMN next_execution timestamptz,
    ADD COLUMN last_executed timestamptz,
    ADD COLUMN error_message text;
  END IF;
END $$;