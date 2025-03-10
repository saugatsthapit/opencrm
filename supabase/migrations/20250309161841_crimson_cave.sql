/*
  # Add step completion tracking

  1. New Tables
    - `step_completions`
      - `id` (uuid, primary key)
      - `lead_sequence_id` (uuid, references lead_sequences)
      - `step_id` (uuid, references sequence_steps)
      - `completed_at` (timestamp)
      - `notes` (text)
      - `completed_by` (uuid, references auth.users)

  2. Changes
    - Add completion tracking for manual steps
    - Allow storing completion notes and metadata

  3. Security
    - Enable RLS on new table
    - Add policies for authenticated users
*/

-- Create step completions table
CREATE TABLE IF NOT EXISTS step_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_sequence_id uuid REFERENCES lead_sequences(id) ON DELETE CASCADE,
  step_id uuid REFERENCES sequence_steps(id) ON DELETE CASCADE,
  completed_at timestamptz DEFAULT now(),
  notes text,
  completed_by uuid REFERENCES auth.users(id),
  UNIQUE(lead_sequence_id, step_id)
);

-- Enable RLS
ALTER TABLE step_completions ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can manage their own step completions"
  ON step_completions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lead_sequences ls
      JOIN sequences s ON s.id = ls.sequence_id
      WHERE ls.id = step_completions.lead_sequence_id
      AND s.user_id = auth.uid()
    )
  );