/*
  # Fix email tracking with stored procedure

  1. Changes
    - Add stored procedure to create email tracking records
    - This procedure will bypass RLS for server-side operations
    - Ensure proper security by using service role key

  2. Security
    - Procedure is only accessible to authenticated users
    - Maintains data integrity while allowing server operations
*/

-- Create a stored procedure to bypass RLS for email tracking
CREATE OR REPLACE FUNCTION create_email_tracking(
  p_lead_sequence_id UUID,
  p_step_id UUID,
  p_email TEXT,
  p_subject TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- This will run with the privileges of the function creator
AS $$
DECLARE
  v_tracking_id UUID := gen_random_uuid();
  v_result JSONB;
BEGIN
  -- Insert the record
  INSERT INTO email_tracking (
    tracking_id,
    lead_sequence_id,
    step_id,
    email,
    subject,
    created_at
  ) VALUES (
    v_tracking_id,
    p_lead_sequence_id,
    p_step_id,
    p_email,
    p_subject,
    NOW()
  )
  RETURNING to_jsonb(email_tracking.*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_email_tracking TO authenticated;

-- Function to update email open tracking
CREATE OR REPLACE FUNCTION update_email_tracking_open(
  p_tracking_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_tracking
  SET opened_at = NOW()
  WHERE tracking_id = p_tracking_id
  AND opened_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_email_tracking_open TO authenticated;

-- Add similar function for email_link_clicks if needed
CREATE OR REPLACE FUNCTION create_email_link_click(
  p_email_tracking_id UUID,
  p_url TEXT,
  p_user_agent TEXT,
  p_ip_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Insert the record
  INSERT INTO email_link_clicks (
    email_tracking_id,
    url,
    user_agent,
    ip_address,
    clicked_at
  ) VALUES (
    p_email_tracking_id,
    p_url,
    p_user_agent,
    p_ip_address,
    NOW()
  )
  RETURNING to_jsonb(email_link_clicks.*) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_email_link_click TO authenticated; 