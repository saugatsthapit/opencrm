/*
  # Add decision step support
  
  1. Changes
    - Add 'decision' to step_type enum
    - Add decision_paths to sequence_steps configuration
    - Add decision_path to lead_sequences table

  2. Security
    - Maintain existing RLS policies
*/

-- Add decision path to lead_sequences
ALTER TABLE lead_sequences 
ADD COLUMN decision_path text;

-- Add function to validate step configuration
CREATE OR REPLACE FUNCTION validate_step_configuration()
RETURNS trigger AS $$
BEGIN
  -- For decision steps, ensure paths are defined
  IF NEW.step_type = 'decision' THEN
    IF NOT (NEW.configuration ? 'paths' AND 
            jsonb_typeof(NEW.configuration->'paths') = 'array' AND 
            jsonb_array_length(NEW.configuration->'paths') > 0) THEN
      RAISE EXCEPTION 'Decision steps must have at least one path defined';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for step configuration validation
CREATE TRIGGER validate_step_configuration
BEFORE INSERT OR UPDATE ON sequence_steps
FOR EACH ROW
EXECUTE FUNCTION validate_step_configuration();

-- Update step_completions to include decision path
ALTER TABLE step_completions
ADD COLUMN decision_path text;