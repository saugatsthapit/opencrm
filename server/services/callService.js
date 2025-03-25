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

/**
 * Makes a call using the VAPI API with fallback to direct API if the SDK fails
 */
const makeVapiCall = async (phoneNumber, leadId, callScript = null, options = {}) => {
  try {
    // Ensure we use full URL for webhook
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;
    const ngrokUrl = process.env.NGROK_URL;
    const webhookUrl = ngrokUrl || (appUrl ? `${appUrl}/api/v1/calls/vapi-webhook` : null);
    
    console.log(`Using webhook URL: ${webhookUrl}`);
    
    // Format phone number to E.164 format if needed
    let formattedPhoneNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedPhoneNumber = phoneNumber.startsWith('1') ? `+${phoneNumber}` : `+1${phoneNumber}`;
    }
    
    // Initialize payload with required parameters
    const callPayload = {
      phoneNumberId: process.env.VITE_VAPI_PHONE_NUMBER_ID,
      assistantId: process.env.VITE_VAPI_ASSISTANT_ID,
      customer: {
        number: formattedPhoneNumber
      },
      metadata: {
        lead_id: leadId,
        test: options.isTest || false,
        timestamp: new Date().toISOString()
      }
    };
    
    // Add webhook configuration if URL is available and valid
    if (webhookUrl && (webhookUrl.startsWith('https://') || webhookUrl.startsWith('http://'))) {
      callPayload.server = {
        url: webhookUrl,
        subscriptions: ['transcripts', 'status-updates', 'messages', 'end-of-call-report']
      };
    }
    
    // Create tracking entry before making the call
    const { data: tracking, error: trackingError } = await supabase
      .from('call_tracking')
      .insert({
        lead_id: leadId,
        status: 'queued',
        created_at: new Date().toISOString(),
        phone_number: formattedPhoneNumber
      })
      .select()
      .single();
      
    if (trackingError) {
      console.error('Error creating call tracking record:', trackingError);
    }
    
    console.log(`Attempting to call ${formattedPhoneNumber} for lead ${leadId}...`);
    
    // Try the SDK first
    try {
      console.log('Using VAPI SDK...');
      const call = await vapiClient.calls.create(callPayload);
      
      // Update tracking record with call_id
      if (tracking) {
        await supabase
          .from('call_tracking')
          .update({
            call_id: call.id,
            status: call.status
          })
          .eq('id', tracking.id);
      }
      
      console.log(`Call created successfully with SDK. Call ID: ${call.id}`);
      return call;
    } catch (sdkError) {
      console.error('SDK call failed, falling back to direct API:', sdkError);
      
      // Fallback to direct API call
      const apiEndpoint = 'https://api.vapi.ai/call/';
      const apiResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_VAPI_PRIVATE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callPayload)
      });
      
      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`API call failed with status ${apiResponse.status}: ${errorText}`);
      }
      
      const call = await apiResponse.json();
      
      // Update tracking record with call_id
      if (tracking) {
        await supabase
          .from('call_tracking')
          .update({
            call_id: call.id,
            status: call.status
          })
          .eq('id', tracking.id);
      }
      
      console.log(`Call created successfully with direct API. Call ID: ${call.id}`);
      return call;
    }
  } catch (error) {
    console.error('Error making VAPI call:', error);
    throw error;
  }
};

/**
 * Place an outbound call using VAPI (Voice AI API)
 * @param {string} phoneNumber - The phone number to call
 * @param {string} leadId - The ID of the lead
 * @param {string} script - The call script configuration (not used - using VAPI assistant config)
 * @returns {object} - The call tracking information
 */
const placeCall = async (phoneNumber, leadId, script = null) => {
  try {
    console.log('Attempting to create VAPI call...');
    
    // Make the call using our enhanced helper function
    const callData = await makeVapiCall(phoneNumber, leadId, script);
    
    return {
      success: true,
      call_id: callData.id,
      status: callData.status,
      customer: callData.customer,
      assistant_id: callData.assistantId,
      phone_number_id: callData.phoneNumberId,
      metadata: callData.metadata
    };
  } catch (vapiError) {
    console.error('Error placing VAPI call:', vapiError);
    throw vapiError;
  }
};

/**
 * Handle call webhook from VAPI (conversation updates)
 * @param {object} webhookData - The webhook data from VAPI
 */
const handleVapiWebhook = async (webhookData) => {
  try {
    console.log('Processing VAPI webhook:', JSON.stringify(webhookData, null, 2));
    
    if (!webhookData || !webhookData.message) {
      console.error('Invalid webhook data format');
      return { error: 'Invalid webhook data format' };
    }
    
    const { message } = webhookData;
    const { type, call } = message;
    
    if (!call || !call.id) {
      console.error('Missing call information in webhook');
      return { error: 'Missing call information' };
    }
    
    // First, find the call tracking record to associate with a lead
    const { data: trackingData, error: trackingError } = await supabase
      .from('call_tracking')
      .select('*')
      .eq('call_id', call.id)
      .single();
      
    if (trackingError) {
      console.error(`Call tracking record not found for call ID ${call.id}:`, trackingError);
      // Try to extract lead ID from metadata if available
      const leadId = call.metadata?.lead_id;
      if (!leadId) {
        return { error: 'Could not determine lead ID for call' };
      }
      
      // Create a new tracking record since one doesn't exist
      const { data: newTracking, error: newError } = await supabase
        .from('call_tracking')
        .insert({
          call_id: call.id,
          lead_id: leadId,
          status: call.status,
          created_at: new Date().toISOString(),
          started_at: call.startedAt || null,
          completed_at: null
        })
        .select()
        .single();
        
      if (newError) {
        console.error('Failed to create call tracking record:', newError);
        return { error: 'Failed to track call' };
      }
    }
    
    // Get tracking record (either existing or newly created)
    const { data: currentTracking } = await supabase
      .from('call_tracking')
      .select('*')
      .eq('call_id', call.id)
      .single();
    
    const leadId = currentTracking?.lead_id || call.metadata?.lead_id;
    
    if (!leadId) {
      console.error('Could not determine lead ID for call');
      return { error: 'Could not determine lead ID for call' };
    }
    
    // Process different webhook event types
    switch (type) {
      case 'status-update':
        await handleStatusUpdate(message, currentTracking, leadId);
        break;
        
      case 'end-of-call-report':
        await handleEndOfCallReport(message, currentTracking, leadId);
        break;
        
      case 'hang':
        await handleHangNotification(message, currentTracking, leadId);
        break;
        
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { error: error.message };
  }
};

// Handle status updates (in-progress, forwarding, ended)
const handleStatusUpdate = async (message, tracking, leadId) => {
  const { status, call } = message;
  
  // Update the call tracking record with the new status
  const { error } = await supabase
    .from('call_tracking')
    .update({
      status: status,
      updated_at: new Date().toISOString(),
      ...(status === 'in-progress' && { started_at: new Date().toISOString() }),
      ...(status === 'ended' && { completed_at: new Date().toISOString() })
    })
    .eq('id', tracking.id);
    
  if (error) {
    console.error('Error updating call status:', error);
  }
  
  console.log(`Call ${call.id} status updated to ${status}`);
};

// Handle end-of-call report with transcript, recording URL, and summary
const handleEndOfCallReport = async (message, tracking, leadId) => {
  const { endedReason, recordingUrl, summary, transcript, messages, call } = message;
  
  // Update the call tracking record with end of call information
  const { error: trackingError } = await supabase
    .from('call_tracking')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      recording_url: recordingUrl || null,
      summary: summary || null,
      ended_reason: endedReason || null
    })
    .eq('id', tracking.id);
    
  if (trackingError) {
    console.error('Error updating call completion info:', trackingError);
  }
  
  // Store the transcript if available
  if (transcript) {
    const { error: transcriptError } = await supabase
      .from('call_conversations')
      .insert({
        call_tracking_id: tracking.id,
        transcript: transcript,
        messages: messages || null,
        created_at: new Date().toISOString()
      });
      
    if (transcriptError) {
      console.error('Error storing call transcript:', transcriptError);
    }
  }
  
  // Mark the lead as called
  const result = await markLeadAsCalled(leadId, {
    callId: call.id,
    notes: summary || 'Call completed',
    success: true,
    recording: recordingUrl
  });
  
  console.log(`Call ${call.id} completed, lead ${leadId} marked as called:`, result);
};

// Handle hang notifications (AI failed to respond)
const handleHangNotification = async (message, tracking, leadId) => {
  const { call } = message;
  
  // Update the call tracking record with hang information
  const { error } = await supabase
    .from('call_tracking')
    .update({
      notes: (tracking.notes ? tracking.notes + '\n' : '') + 'AI hang detected during call',
      updated_at: new Date().toISOString()
    })
    .eq('id', tracking.id);
    
  if (error) {
    console.error('Error updating call with hang notification:', error);
  }
  
  console.log(`Hang notification for call ${call.id}`);
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
      const result = await makeVapiCall(formattedPhoneNumber, null, null, { isTest: true });
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
    // Find any call tracking records for this lead
    const { data: callData, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        call_conversations (
          transcript,
          messages
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching lead call status:', error);
      return { error: 'Failed to fetch call status' };
    }
    
    // If no calls found, return not called
    if (!callData || callData.length === 0) {
      return { has_been_called: false };
    }
    
    // Return the latest call details
    const lastCall = callData[0];
    const lastCallConversation = lastCall.call_conversations && lastCall.call_conversations.length > 0 
      ? lastCall.call_conversations[0] 
      : null;
    
    return {
      has_been_called: true,
      last_call: {
        id: lastCall.call_id,
        status: lastCall.status,
        timestamp: lastCall.created_at,
        recording_url: lastCall.recording_url,
        error_message: lastCall.error_message,
        transcript: lastCallConversation?.transcript,
        summary: lastCall.summary || null,
        ended_reason: lastCall.ended_reason || null,
        notes: lastCall.notes || null,
        interest_status: lastCall.interest_status || null,
        success: lastCall.status === 'completed' || lastCall.status === 'ended'
      },
      all_calls: callData.map(call => ({
        id: call.call_id,
        status: call.status,
        timestamp: call.created_at,
        recording_url: call.recording_url || null,
        interest_status: call.interest_status || null,
        success: call.status === 'completed' || call.status === 'ended'
      }))
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