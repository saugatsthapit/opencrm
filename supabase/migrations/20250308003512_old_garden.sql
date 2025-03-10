/*
  # CRM Database Schema

  1. New Tables
    - `leads`
      - Basic lead information
      - Company details
      - Contact information
    - `sequences`
      - Sequence name and description
    - `sequence_steps`
      - Steps in each sequence
      - Step type and configuration
    - `lead_sequences`
      - Junction table for leads in sequences
      - Tracks progress and status

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  mobile_phone1 text,
  mobile_phone2 text,
  title text,
  linkedin text,
  location text,
  company_name text,
  company_domain text,
  company_website text,
  company_employee_count int,
  company_employee_count_range text,
  company_founded int,
  company_industry text,
  company_type text,
  company_headquarters text,
  company_revenue_range text,
  company_linkedin_url text,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

-- Create sequences table
CREATE TABLE IF NOT EXISTS sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id)
);

-- Create sequence steps table
CREATE TABLE IF NOT EXISTS sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES sequences(id) ON DELETE CASCADE,
  step_type text NOT NULL, -- 'email', 'linkedin_request', 'call'
  step_order int NOT NULL,
  configuration jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create lead sequences junction table
CREATE TABLE IF NOT EXISTS lead_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES sequences(id) ON DELETE CASCADE,
  current_step int DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, sequence_id)
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sequences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sequences"
  ON sequences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage sequence steps"
  ON sequence_steps
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sequences
    WHERE sequences.id = sequence_steps.sequence_id
    AND sequences.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage lead sequences"
  ON lead_sequences
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_sequences.lead_id
    AND leads.user_id = auth.uid()
  ));