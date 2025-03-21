const { supabase } = require('../config/supabase.js');
const dotenv = require('dotenv');
const { VapiClient } = require('@vapi-ai/server-sdk');
const fetch = require('node-fetch');

dotenv.config();

// Get the VAPI API key from the environment, with more explicit fallback/validation
const VAPI_PUBLIC_KEY = process.env.VITE_VAPI_API_KEY || '0e0037b2-4158-480e-b6c3-969e07fa5d17'; // Public key for client-side
const VAPI_PRIVATE_KEY = process.env.VITE_VAPI_PRIVATE_KEY || '8cb1acea-c543-4f99-b0ac-0b7dba16ca13'; // Private key for server-side
const VAPI_BASE_URL = 'https://api.vapi.ai/call';

// Debug environment variables
console.log('Current env:', process.env.NODE_ENV);
console.log('VAPI public key available:', !!VAPI_PUBLIC_KEY);
console.log('VAPI public key starts with:', VAPI_PUBLIC_KEY ? VAPI_PUBLIC_KEY.substring(0, 8) + '...' : 'N/A');
console.log('VAPI private key available:', !!VAPI_PRIVATE_KEY);
console.log('VAPI private key starts with:', VAPI_PRIVATE_KEY ? VAPI_PRIVATE_KEY.substring(0, 8) + '...' : 'N/A');

// VAPI configuration for outbound calls
const VAPI_ASSISTANT_ID = process.env.VITE_VAPI_ASSISTANT_ID || '7d38bf23-7cc9-4a85-b8c1-a00ac9c20a16';
const VAPI_PHONE_NUMBER_ID = process.env.VITE_VAPI_PHONE_NUMBER_ID || 'ae2a1cd1-e8e7-4afd-a57e-99aef8d9e54e';

// Initialize VAPI client with the PRIVATE key
const vapiClient = new VapiClient({ 
  apiKey: VAPI_PRIVATE_KEY.trim() // Use private key for server SDK
});
console.log('VAPI client initialized with private key');

// Track call statuses in memory for quick access
const callStatusMap = new Map();

// Helper function to format phone numbers to E.164 standard
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // If the number already has a +, just return it with only digits
  if (phoneNumber.startsWith('+')) {
    return '+' + digitsOnly;
  }
  
  // If it starts with a 1 (US), add + prefix
  if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
    return '+' + digitsOnly;
  }
  
  // If it's a 10-digit number (assuming US), add +1 prefix
  if (digitsOnly.length === 10) {
    return '+1' + digitsOnly;
  }
  
  // For any other format, just add + prefix
  return '+' + digitsOnly;
};

// Helper function to make VAPI calls (handles SDK and direct API approaches)
const makeVapiCall = async (callPayload) => {
  try {
    // Try SDK first
    console.log('Attempting to create VAPI call with SDK...');
    const result = await vapiClient.calls.create(callPayload);
    console.log('VAPI SDK call successful:', result);
    return result;
  } catch (sdkError) {
    console.error('VAPI SDK call error:', sdkError);
    
    // Try direct API if SDK fails
    console.log('Falling back to direct API call...');
    try {
      const response = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
        },
        body: JSON.stringify(callPayload)
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Direct API call failed:', responseData);
        throw new Error(`Direct API call failed: ${response.status} - ${JSON.stringify(responseData)}`);
      }
      
      console.log('Direct API call succeeded:', responseData);
      return responseData;
    } catch (directError) {
      console.error('Direct API call error:', directError);
      throw directError;
    }
  }
};

/**
 * Place an outbound call using VAPI (Voice AI API)
 * @param {string} phone_number - The phone number to call
 * @param {object} lead - The lead data for the call
 * @param {object} callScript - The call script configuration (not used - using VAPI assistant config)
 * @param {string} leadSequenceId - The ID of the lead sequence
 * @param {string} stepId - The ID of the step in the sequence
 * @returns {object} - The call tracking information
 */
const placeCall = async (phone_number, lead, callScript, leadSequenceId, stepId) => {
  try {
    console.log(`Preparing to call ${phone_number} for lead ${lead.id}`);
    
    if (!phone_number) {
      throw new Error('Phone number is required for call step');
    }

    // Ensure phone number is in E.164 format
    const formattedPhoneNumber = formatPhoneNumber(phone_number);
    console.log(`Formatted phone number: ${formattedPhoneNumber}`);
    
    if (!VAPI_PRIVATE_KEY) {
      throw new Error('VAPI Private key is required for cold calling. Please set VITE_VAPI_PRIVATE_KEY in your .env file.');
    }

    // Create tracking record
    let tracking;
    try {
      const { data, error } = await supabase
        .from('call_tracking')
        .insert({
          lead_sequence_id: leadSequenceId,
          step_id: stepId,
          phone_number: formattedPhoneNumber,
          lead_id: lead.id
        })
        .select()
        .single();

      if (error) {
        console.error('Call tracking record creation failed:', error);
        
        // Try a direct SQL approach if RLS is the issue
        if (error.code === '42501') {
          console.log('Attempting to bypass RLS with rpc call...');
          const { data: rpcData, error: rpcError } = await supabase.rpc('create_call_tracking', {
            p_lead_id: lead.id,
            p_lead_sequence_id: leadSequenceId || null,
            p_phone_number: formattedPhoneNumber,
            p_step_id: stepId || null
          });
          
          if (rpcError) {
            console.error('RPC call tracking creation failed:', rpcError);
            throw rpcError;
          }
          
          tracking = rpcData;
          console.log('Created call tracking record via RPC:', tracking);
        } else {
          throw error;
        }
      } else {
        tracking = data;
        console.log('Created call tracking record:', tracking);
      }
    } catch (trackingError) {
      console.error('All tracking creation attempts failed:', trackingError);
      
      // Create a local tracking object to continue with call
      tracking = {
        tracking_id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        id: null,
        phone_number: formattedPhoneNumber,
        lead_id: lead.id
      };
      console.log('Using local tracking as fallback:', tracking);
    }
    
    // Check if real calls are enabled (either in production or explicitly enabled)
    const enableRealCalls = process.env.NODE_ENV === 'production' || process.env.VITE_ENABLE_REAL_CALLS === 'true';
    
    let callData;
    
    if (enableRealCalls) {
      try {
        console.log('Making REAL call to', formattedPhoneNumber);
        
        // Create minimal payload using VAPI's assistant configuration
        const callPayload = {
          // Name of the call for reference
          name: `Call to ${lead.first_name || lead.last_name || formattedPhoneNumber}`,
          
          // Use existing phone number ID
          phoneNumberId: VAPI_PHONE_NUMBER_ID,
          
          // Use existing assistant ID (which has the call script configured)
          assistantId: VAPI_ASSISTANT_ID,
          
          // Only required customer fields
          customer: {
            number: formattedPhoneNumber,
            name: lead.first_name || lead.last_name || 'Lead'
          }
        };
        
        // Log just the SDK call attempt
        console.log('Attempting to create VAPI call...');
        
        try {
          // Make the call using the helper function
          callData = await makeVapiCall(callPayload);
          console.log('VAPI call successfully initiated:', callData);
        } catch (vapiError) {
          console.error('VAPI call error:', vapiError);
          throw vapiError;
        }
      } catch (vapiError) {
        console.error('VAPI call error:', vapiError);
        // Fall back to simulation if VAPI call fails
        console.log('FALLBACK: Simulating VAPI call due to error');
        callData = {
          id: `vapi_${Date.now()}`,
          status: 'queued',
          createdAt: new Date().toISOString(),
          error: vapiError.message
        };
      }
    } else {
      // Simulated response for development
      console.log('DEVELOPMENT MODE: Simulating VAPI call instead of making real call');
      callData = {
        id: `vapi_${Date.now()}`,
        status: 'queued',
        createdAt: new Date().toISOString()
      };
    }
    
    console.log('Call initiated:', callData);
    
    // Update tracking record with call ID
    if (tracking.id) {
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({ 
          call_id: callData.id,
          status: callData.status || 'queued',
          started_at: new Date().toISOString()
        })
        .eq('id', tracking.id);

      if (updateError) {
        console.error('Failed to update call tracking record:', updateError);
      }
    }
    
    // Store in memory for quick access
    callStatusMap.set(callData.id, {
      status: callData.status || 'queued',
      tracking_id: tracking.tracking_id,
      lead_sequence_id: leadSequenceId,
      step_id: stepId
    });

    console.log(`Call initiated with ID: ${callData.id}`);
    return { ...tracking, call_id: callData.id, call_status: callData.status || 'queued' };
  } catch (error) {
    console.error('Error in placeCall:', error);
    throw error;
  }
};

/**
 * Handle call webhook from VAPI (conversation updates)
 * @param {object} webhookData - The webhook data from VAPI
 */
const handleVapiWebhook = async (webhookData) => {
  try {
    console.log('Received VAPI webhook:', JSON.stringify(webhookData, null, 2));
    
    // The webhook data structure has changed - check for message wrapper
    let call_id, status, customer, artifact, metadata;
    
    if (webhookData.message) {
      // Extract from message structure
      ({ status } = webhookData.message);
      
      if (webhookData.message.call) {
        call_id = webhookData.message.call.id;
        customer = webhookData.message.call.customer;
        metadata = webhookData.message.call.metadata;
      }
      
      if (webhookData.message.artifact) {
        artifact = webhookData.message.artifact;
      }
      
      console.log(`Extracted call ID from message structure: ${call_id}`);
    } else {
      // Use original structure as fallback
      ({ id: call_id, status, customer, artifact, metadata } = webhookData);
    }
    
    if (!call_id) {
      console.error('No call_id in VAPI webhook data');
      return;
    }
    
    // Update in-memory status
    const callInfo = callStatusMap.get(call_id);
    if (callInfo) {
      callInfo.status = status;
      if (status === 'ended') {
        callInfo.completed = true;
      }
    }
    
    // Find the tracking record
    const { data: trackingData, error: findError } = await supabase
      .from('call_tracking')
      .select('id, started_at')
      .eq('call_id', call_id)
      .maybeSingle();
    
    if (findError || !trackingData) {
      console.warn(`No call tracking record found for call_id: ${call_id}. Attempting to create one.`);
      
      // Try to create a new tracking record
      if (status) {
        try {
          const { data, error } = await supabase
            .from('call_tracking')
            .insert({
              call_id: call_id,
              status: status,
              tracking_id: `vapi-${call_id.substring(0, 8)}`,
              phone_number: customer ? customer.number : null,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (!error) {
            console.log(`Created new call tracking record for call_id: ${call_id}`);
            trackingData = data;
          } else {
            console.error('Error creating call tracking record:', error);
          }
        } catch (err) {
          console.error('Failed to create tracking record:', err.message);
        }
      }
      
      if (!trackingData) return;
    }
    
    // Update call status
    const updateData = {
      status: status
    };
    
    // Update additional fields based on call status
    if (status === 'ended') {
      updateData.completed_at = new Date().toISOString();
      
      // Log ended reason if available
      if (webhookData.message && webhookData.message.endedReason) {
        updateData.error_message = webhookData.message.endedReason;
        console.log(`Call ended with reason: ${webhookData.message.endedReason}`);
      }
      
      // Add recording details if available
      if (artifact) {
        if (artifact.recordingUrl) {
          updateData.recording_url = artifact.recordingUrl;
        }
        
        // Store conversation details
        if (artifact.transcript || artifact.messages) {
          try {
            await supabase
              .from('call_conversations')
              .insert({
                call_tracking_id: trackingData.id,
                transcript: artifact.transcript,
                conversation_data: artifact.messages,
                created_at: new Date().toISOString()
              });
            
            console.log('Stored call conversation transcript and messages');
          } catch (convError) {
            console.error('Error storing call conversation:', convError);
          }
        }
      }
    } else if (status === 'in-progress' && !trackingData.started_at) {
      updateData.started_at = new Date().toISOString();
    }
    
    // Update the tracking record
    const { error: updateError } = await supabase
      .from('call_tracking')
      .update(updateData)
      .eq('id', trackingData.id);
    
    if (updateError) {
      console.error('Error updating call tracking status:', updateError);
    } else {
      console.log(`Successfully updated status to ${status} for call ${call_id}`);
    }
  } catch (error) {
    console.error('Error handling VAPI webhook:', error);
  }
};

/**
 * Get the status of a call
 * @param {string} callId - The ID of the call
 */
const getCallStatus = async (callId) => {
  // First check in-memory map for quick access
  if (callStatusMap.has(callId)) {
    return callStatusMap.get(callId);
  }
  
  // Otherwise check the database
  try {
    const { data, error } = await supabase
      .from('call_tracking')
      .select('*')
      .eq('call_id', callId)
      .single();
    
    if (error) {
      console.error('Error fetching call status:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in getCallStatus:', error);
    return null;
  }
};

/**
 * Test VAPI configuration with a simpler call
 * @param {string} phoneNumber - Phone number to test call
 * @returns {object} - Test result
 */
const testVapiConfiguration = async (phoneNumber) => {
  try {
    // Format the phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    
    // Log the keys being used
    console.log('Testing VAPI configuration with:');
    console.log('- Private key (first 8 chars):', VAPI_PRIVATE_KEY.substring(0, 8) + '...');
    console.log('- Public key (first 8 chars):', VAPI_PUBLIC_KEY.substring(0, 8) + '...');
    console.log('- Assistant ID:', VAPI_ASSISTANT_ID);
    console.log('- Phone Number ID:', VAPI_PHONE_NUMBER_ID);
    
    // Create minimal payload for the test call
    const simplePayload = {
      name: "VAPI Test Call",
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      assistantId: VAPI_ASSISTANT_ID,
      customer: {
        number: formattedPhoneNumber,
        name: "Test User"
      }
    };
    
    console.log('Call payload:', JSON.stringify(simplePayload, null, 2));
    
    try {
      // Make the call using our helper function
      const result = await makeVapiCall(simplePayload);
      console.log('VAPI test call successful:', result);
      return { success: true, call_id: result.id, message: 'Test call successful!' };
    } catch (error) {
      console.error('VAPI test call failed:', error);
      return { 
        success: false, 
        error: error.message || JSON.stringify(error),
        details: error
      };
    }
  } catch (error) {
    console.error('Error testing VAPI configuration:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get the call history for a lead
 * @param {string} leadId - The ID of the lead
 * @returns {object} - Call history information
 */
const getLeadCallStatus = async (leadId) => {
  try {
    // Get the most recent call tracking record for this lead
    const { data: callHistory, error } = await supabase
      .from('call_tracking')
      .select(`
        id,
        call_id,
        status,
        created_at,
        started_at,
        completed_at,
        recording_url,
        error_message,
        call_conversations (
          transcript,
          conversation_data
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching lead call history:', error);
      return { error: 'Failed to fetch call history' };
    }

    // If no call history exists
    if (!callHistory || callHistory.length === 0) {
      return { 
        called: false,
        lastCall: null
      };
    }

    const lastCall = callHistory[0];
    return {
      called: true,
      lastCall: {
        id: lastCall.call_id,
        status: lastCall.status,
        calledAt: lastCall.started_at || lastCall.created_at,
        completedAt: lastCall.completed_at,
        recording: lastCall.recording_url,
        error: lastCall.error_message,
        transcript: lastCall.call_conversations?.[0]?.transcript,
        success: lastCall.status === 'completed' || lastCall.status === 'ended'
      }
    };
  } catch (error) {
    console.error('Error in getLeadCallStatus:', error);
    return { error: error.message };
  }
};

/**
 * Manually mark a lead as called
 * @param {string} leadId - The ID of the lead
 * @param {object} callDetails - Optional details about the manual call
 * @returns {object} - Updated call status
 */
const markLeadAsCalled = async (leadId, callDetails = {}) => {
  try {
    // Check if this is a reset operation
    if (callDetails.reset) {
      // Delete the call tracking records for this lead to reset its status
      const { error: deleteError } = await supabase
        .from('call_tracking')
        .delete()
        .match({ lead_id: leadId, manual_entry: true });
      
      if (deleteError) {
        console.error('Error resetting call status:', deleteError);
        return { error: 'Failed to reset call status' };
      }
      
      return {
        success: true,
        called: false,
        reset: true
      };
    }
    
    const now = new Date().toISOString();

    // Create a call tracking record for the manual call
    const { data: tracking, error } = await supabase
      .from('call_tracking')
      .insert({
        lead_id: leadId,
        status: 'completed',
        call_id: `manual_${Date.now()}`,
        created_at: now,
        started_at: callDetails.calledAt || now,
        completed_at: now,
        notes: callDetails.notes || 'Manually marked as called',
        manual_entry: true
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating manual call record:', error);
      return { error: 'Failed to mark lead as called' };
    }

    // If call details include conversation notes, store them
    if (callDetails.conversationNotes) {
      const { error: convError } = await supabase
        .from('call_conversations')
        .insert({
          call_tracking_id: tracking.id,
          transcript: callDetails.conversationNotes,
          created_at: now
        });

      if (convError) {
        console.error('Error storing conversation notes:', convError);
      }
    }

    return {
      success: true,
      called: true,
      lastCall: {
        id: tracking.call_id,
        status: 'completed',
        calledAt: tracking.started_at,
        completedAt: tracking.completed_at,
        manual: true,
        notes: tracking.notes
      }
    };
  } catch (error) {
    console.error('Error in markLeadAsCalled:', error);
    return { error: error.message };
  }
};

// Export all functions using CommonJS syntax
module.exports = {
  placeCall,
  handleVapiWebhook,
  getCallStatus,
  testVapiConfiguration,
  getLeadCallStatus,
  markLeadAsCalled,
  VAPI_PUBLIC_KEY,
  VAPI_PRIVATE_KEY
}; 