const express = require('express');
const { 
  placeCall, 
  handleCallStatus, 
  handleRecording,
  getTwiMlForTracking,
  getCallStatus,
  createVapiBridge,
  handleVapiWebhook,
  testVapiConfiguration,
  getLeadCallStatus,
  markLeadAsCalled
} = require('../services/callService.js');
const { supabase } = require('../config/supabase.js');
const callValidation = require('../middleware/callValidation');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { Call, CallHistory } = require('../models');
const { saveSequenceStep } = require('../services/workflowService');
const { getDbClient } = require('../config/supabase.js');
require('dotenv').config();

const router = express.Router();

// For additional operations that might need higher privileges, create a service client
// but only if the environment variables are available
let supabaseServiceClient;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or key missing in environment variables. Service client will not be available.');
    console.warn('This is fine for development if you are not using Supabase features.');
  } else {
    supabaseServiceClient = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase service client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Supabase service client:', error);
}

// Helper function to add CORS headers to all responses
const addCorsHeaders = (res, origin) => {
  // If no origin, allow all
  const allowedOrigin = origin || '*';
  
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  console.log(`[CORS] Set headers for origin: ${allowedOrigin}`);
  return res;
};

// Handle preflight OPTIONS requests for all routes
router.options('*', (req, res) => {
  console.log(`[CORS] Handling OPTIONS request from origin: ${req.headers.origin}`);
  addCorsHeaders(res, req.headers.origin);
  return res.status(200).send();
});

// Helper to fetch lead data from Supabase
const fetchLeadData = async (leadId) => {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
      
    if (error) {
      console.error('Error fetching lead data from Supabase:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Exception fetching lead data:', error);
    return null;
  }
};

// Helper to process script with lead data
const processScript = (script, lead) => {
  // Start with a copy of the script
  const processedScript = { ...script };
  
  // For each value in the script, replace placeholders with lead data
  const replacePlaceholders = (text) => {
    if (!text) return '';
    
    // Replace first name
    text = text.replace(/{{firstName}}/g, lead.first_name || '');
    // Replace last name
    text = text.replace(/{{lastName}}/g, lead.last_name || '');
    // Replace full name
    text = text.replace(/{{fullName}}/g, `${lead.first_name || ''} ${lead.last_name || ''}`);
    // Replace company
    text = text.replace(/{{company}}/g, lead.company_name || '');
    // Replace title
    text = text.replace(/{{title}}/g, lead.title || '');
    
    return text;
  };
  
  // Process script fields
  if (processedScript.greeting) processedScript.greeting = replacePlaceholders(processedScript.greeting);
  if (processedScript.introduction) processedScript.introduction = replacePlaceholders(processedScript.introduction);
  if (processedScript.closing) processedScript.closing = replacePlaceholders(processedScript.closing);
  
  // Process arrays in the script
  if (Array.isArray(processedScript.talking_points)) {
    processedScript.talking_points = processedScript.talking_points.map(replacePlaceholders);
  }
  
  if (Array.isArray(processedScript.questions)) {
    processedScript.questions = processedScript.questions.map(replacePlaceholders);
  }
  
  return processedScript;
};

/**
 * Place an outbound call
 */
router.post('/', async (req, res) => {
  try {
    // Log the entire request for debugging
    console.log('Received request to /api/v1/calls:');
    console.log('- Headers:', req.headers);
    console.log('- Origin:', req.headers.origin);
    console.log('- Path:', req.path);
    console.log('- Method:', req.method);
    console.log('- Body:', JSON.stringify(req.body, null, 2));
    
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { phone_number, lead, script, lead_sequence_id, step_id } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    if (!lead) {
      return res.status(400).json({
        success: false,
        error: 'Lead information is required'
      });
    }
    
    if (!script) {
      return res.status(400).json({
        success: false,
        error: 'Call script is required'
      });
    }
    
    // Extract lead ID from the lead object or use the lead object as the ID
    const leadId = typeof lead === 'object' ? lead.id : lead;
    
    console.log(`Placing call to ${phone_number} for lead ID ${leadId}`);
    
    // Process the script with lead data if lead is an object
    const leadData = typeof lead === 'object' ? lead : await fetchLeadData(leadId);
    if (!leadData) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }
    
    // Process the script with lead data
    const processedScript = processScript(script, leadData);
    
    // Place the call - always pass just the leadId
    const result = await placeCall(phone_number, leadId, processedScript);
    
    console.log('Call placed successfully:', result);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Call initiated successfully',
      ...result
    });
  } catch (error) {
    console.error('Error in POST /api/v1/calls:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to place call'
    });
  }
});

/**
 * @route POST /api/v1/calls/place
 * @desc Place an outbound call to a lead using VAPI
 * @access Private
 */
router.post('/place', callValidation.validateOutboundCall, async (req, res) => {
  try {
    console.log(`[Calls API] Received call request from origin: ${req.headers.origin}`);
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { phone_number, lead_id, call_script } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    if (!lead_id) {
      return res.status(400).json({
        success: false,
        message: 'Lead ID is required'
      });
    }
    
    if (!call_script) {
      return res.status(400).json({
        success: false,
        message: 'Call script is required'
      });
    }
    
    const leadData = await fetchLeadData(lead_id);
    if (!leadData) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    
    console.log('Placing call with VAPI to:', phone_number);
    console.log('Lead data:', leadData);
    
    // Update the call script with lead data
    const processedScript = processScript(call_script, leadData);
    
    // Place the call - pass just the leadId instead of the full leadData object
    const result = await placeCall(phone_number, lead_id, processedScript);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Call initiated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error placing call:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to place call'
    });
  }
});

/**
 * @route POST /api/v1/calls/place-batch
 * @desc Place multiple outbound calls to leads using VAPI
 * @access Private
 */
router.post('/place-batch', callValidation.validateOutboundCall, async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { lead_ids, call_script, delay_seconds = 60 } = req.body;
    
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one lead ID is required'
      });
    }
    
    if (!call_script) {
      return res.status(400).json({
        success: false,
        message: 'Call script is required'
      });
    }
    
    // Fetch all leads data in one go to be efficient
    const leadResults = [];
    
    for (const lead_id of lead_ids) {
      const leadData = await fetchLeadData(lead_id);
      
      if (!leadData) {
        leadResults.push({
          lead_id,
          success: false,
          message: 'Lead not found'
        });
        continue;
      }
      
      if (!leadData.phone) {
        leadResults.push({
          lead_id,
          success: false,
          message: 'Lead has no phone number'
        });
        continue;
      }
      
      // Add to queue for processing (only first call is immediate)
      leadResults.push({
        lead_id,
        phone: leadData.phone,
        name: `${leadData.first_name} ${leadData.last_name}`,
        queued: true,
        success: true,
        message: 'Lead queued for calling'
      });
    }
    
    // Process the first lead immediately if there are valid leads
    const validLeads = leadResults.filter(result => result.success);
    if (validLeads.length > 0) {
      const firstLead = validLeads[0];
      const leadData = await fetchLeadData(firstLead.lead_id);
      const processedScript = processScript(call_script, leadData);
      
      try {
        // Place the call with just the lead ID
        const result = await placeCall(firstLead.phone, firstLead.lead_id, processedScript);
        firstLead.call_result = result;
        firstLead.queued = false;
        firstLead.message = 'Call initiated successfully';
      } catch (error) {
        console.error(`Error placing call to lead ${firstLead.lead_id}:`, error);
        firstLead.success = false;
        firstLead.queued = false;
        firstLead.message = error.message || 'Failed to place call';
      }
    }
    
    // Return success response with information about all leads
    return res.status(200).json({
      success: true,
      message: `Processed ${leadResults.length} leads. ${validLeads.length} valid for calling.`,
      data: {
        leads: leadResults,
        first_call_placed: validLeads.length > 0
      }
    });
  } catch (error) {
    console.error('Error placing batch calls:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to place batch calls'
    });
  }
});

/**
 * VAPI Bridge - Creates TwiML to bridge Twilio to VAPI
 */
router.get('/vapi-bridge/:trackingId', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { trackingId } = req.params;
    console.log(`VAPI bridge request received for tracking ID: ${trackingId}`);
    
    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID is required' });
    }
    
    const result = await createVapiBridge(trackingId);
    
    // Set content type to XML
    res.set('Content-Type', 'text/xml');
    res.send(result.twiml);
  } catch (error) {
    console.error('VAPI bridge error:', error);
    
    // Send a basic TwiML response in case of error
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Say>We're sorry, but an error occurred while connecting to our AI assistant.</Say>
      </Response>
    `);
  }
});

/**
 * VAPI Bridge POST endpoint - To handle Twilio POST webhooks
 */
router.post('/vapi-bridge/:trackingId', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { trackingId } = req.params;
    console.log(`VAPI bridge POST request received for tracking ID: ${trackingId}`);
    console.log('Request body:', req.body);
    
    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID is required' });
    }
    
    const result = await createVapiBridge(trackingId);
    
    // Set content type to XML
    res.set('Content-Type', 'text/xml');
    res.send(result.twiml);
  } catch (error) {
    console.error('VAPI bridge POST error:', error);
    
    // Send a basic TwiML response in case of error
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Say>We're sorry, but an error occurred while connecting to our AI assistant.</Say>
      </Response>
    `);
  }
});

/**
 * Get TwiML for a call using tracking ID (fallback method)
 */
router.get('/twiml/:trackingId', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { trackingId } = req.params;
    console.log(`TwiML request received for tracking ID: ${trackingId}`);
    
    if (!trackingId) {
      return res.status(400).json({ error: 'Tracking ID is required' });
    }
    
    const twiml = await getTwiMlForTracking(trackingId);
    
    // Set content type to XML
    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('TwiML generation error:', error);
    
    // Send a basic TwiML response in case of error
    res.set('Content-Type', 'text/xml');
    res.send(`
      <Response>
        <Say>We're sorry, but an error occurred with this call. Please try again later.</Say>
      </Response>
    `);
  }
});

/**
 * Handle call status webhook
 */
router.post('/status', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    console.log('Call status webhook received:', req.body);
    await handleCallStatus(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Status webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle recording webhook
 */
router.post('/recording', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    console.log('Recording webhook received:', req.body);
    await handleRecording(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Recording webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/calls/vapi-webhook
 * @desc Handle webhooks from VAPI for call status updates and end-of-call reports
 */
router.post('/vapi-webhook', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    console.log('Received VAPI webhook:', JSON.stringify(req.body, null, 2));
    
    // Check if we have messageResponse format (new format) or the older message format
    const messageData = req.body.messageResponse ? req.body.messageResponse : req.body;
    
    // Determine webhook type based on content
    let webhookType;
    let callId;
    let leadId;
    let summary;
    let recordingUrl;
    let transcript;
    let messages;
    
    // Extract call ID and other data
    if (messageData.assistant && messageData.assistantId) {
      // New format
      callId = messageData.callId || '';
      leadId = messageData.metadata?.lead_id || '';
      
      // Check for end-of-call-report
      if (messageData.message && messageData.message.type === 'end-of-call-report') {
        webhookType = 'end-of-call-report';
        summary = messageData.message.summary || '';
        recordingUrl = messageData.message.recordingUrl || '';
        transcript = messageData.message.transcript || '';
        messages = messageData.message.messages || [];
      } else if (messageData.message && messageData.message.type === 'status-update') {
        webhookType = 'status-update';
        const status = messageData.message.status || '';
        console.log(`Status update for call ${callId}: ${status}`);
      }
    } else if (messageData.message && messageData.message.type) {
      // Old format
      webhookType = messageData.message.type;
      callId = messageData.message.call?.id || '';
      leadId = messageData.message.call?.metadata?.lead_id || '';
      
      if (webhookType === 'end-of-call-report') {
        summary = messageData.message.summary || '';
        recordingUrl = messageData.message.recordingUrl || '';
        transcript = messageData.message.transcript || '';
        messages = messageData.message.messages || [];
      }
    }
    
    console.log(`Webhook type: ${webhookType}, Call ID: ${callId}, Lead ID: ${leadId}`);
    
    if (!callId) {
      console.warn('No call ID found in webhook data');
      return res.status(200).json({
        success: false,
        message: 'Missing call ID in webhook data'
      });
    }
    
    // Process the webhook based on type
    if (webhookType === 'end-of-call-report') {
      // Extract the recording URLs from the message
      const recordingUrl = messageData.message?.recordingUrl || messageData.message?.artifact?.recordingUrl || null;
      const stereoRecordingUrl = messageData.message?.stereoRecordingUrl || messageData.message?.artifact?.stereoRecordingUrl || null;
      
      // Extract cost information
      const cost = messageData.message?.cost || 0;
      const costBreakdown = messageData.message?.costBreakdown || null;
      const durationSeconds = messageData.message?.durationSeconds || 0;
      
      // Store the call summary and update call status
      const callResult = await getDbClient()
        .from('call_tracking')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          recording_url: recordingUrl,
          stereo_recording_url: stereoRecordingUrl,
          summary: messageData.message?.summary || null,
          ended_reason: messageData.message?.endedReason || null,
          duration: durationSeconds,
          cost: cost,
          cost_breakdown: costBreakdown
        })
        .eq('call_id', callId)
        .select()
        .single();
      
      if (callResult.error) {
        console.error('Error updating call with end-of-call report:', callResult.error);
      } else if (callResult.data) {
        // Extract transcript and messages from the webhook data
        const transcript = messageData.message?.transcript || messageData.message?.artifact?.transcript || null;
        const messages = messageData.message?.messages || messageData.message?.artifact?.messages || null;
        const analysis = messageData.message?.analysis || null;
        
        // Store the transcript if available
        if (transcript || messages) {
          const transcriptResult = await getDbClient()
            .from('call_conversations')
            .insert({
              call_tracking_id: callResult.data.id,
              transcript: transcript,
              messages: messages,
              analysis: analysis,
              created_at: new Date().toISOString()
            });
            
          if (transcriptResult.error) {
            console.error('Error storing call transcript:', transcriptResult.error);
          } else {
            console.log(`Stored transcript and messages for call ${callId}`);
          }
        }
        
        console.log(`Successfully processed end-of-call report for ${callId}`);
      }
    } else if (webhookType === 'status-update') {
      // Update call status
      const status = messageData.message.status || 'unknown';
      const statusResult = await getDbClient()
        .from('call_tracking')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
          ...(status === 'in-progress' && { started_at: new Date().toISOString() }),
          ...(status === 'ended' && { completed_at: new Date().toISOString() })
        })
        .eq('call_id', callId);
        
      if (statusResult.error) {
        console.error('Error updating call status:', statusResult.error);
      } else {
        console.log(`Updated status for call ${callId} to ${status}`);
      }
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      webhookType
    });
  } catch (error) {
    console.error('Error processing VAPI webhook:', error);
    // Always return 200 for webhooks, even on errors
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/calls/status/:callId
 * @desc Get the status of a call by ID
 */
router.get('/status/:callId', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { callId } = req.params;
    const callStatus = await getCallStatus(callId);
    
    if (!callStatus) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }
    
    return res.json({
      success: true,
      data: callStatus
    });
  } catch (error) {
    console.error('Error in /calls/status/:callId:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * Get call history for a specific lead
 */
router.get('/history/:leadId', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { leadId } = req.params;
    
    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: 'Lead ID is required'
      });
    }
    
    console.log(`Fetching call history for lead ${leadId}`);
    
    // Get call history with conversations
    const { data, error } = await getDbClient()
      .from('call_tracking')
      .select(`
        id,
        call_id,
        lead_id,
        phone_number,
        status,
        created_at,
        started_at,
        completed_at,
        failed_at,
        recording_url,
        stereo_recording_url,
        notes,
        interest_status,
        duration,
        cost,
        cost_breakdown,
        ended_reason,
        summary,
        metadata,
        conversations:call_conversations(
          id,
          transcript,
          conversation_data,
          messages,
          analysis,
          created_at
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching call history:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch call history'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error getting call history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get call history'
    });
  }
});

// Test VAPI configuration
router.post('/test-vapi', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { phone_number } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required for testing'
      });
    }
    
    console.log(`Testing VAPI configuration with phone number: ${phone_number}`);
    
    // Call the test function
    const result = await testVapiConfiguration(phone_number);
    
    // Return results
    return res.json(result);
  } catch (error) {
    console.error('Error testing VAPI configuration:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get call status for a lead
 * GET /api/v1/calls/lead/:leadId/status
 */
router.get('/lead/:leadId/status', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { leadId } = req.params;
    const status = await getLeadCallStatus(leadId);
    res.json(status);
  } catch (error) {
    console.error('Error getting lead call status:', error);
    res.status(500).json({ error: 'Failed to get lead call status' });
  }
});

/**
 * Mark a lead as called
 * POST /api/v1/calls/lead/:leadId/mark-called
 */
router.post('/lead/:leadId/mark-called', async (req, res) => {
  try {
    // Add CORS headers
    addCorsHeaders(res, req.headers.origin);
    
    const { leadId } = req.params;
    const { callDetails, reset } = req.body; // Support for reset flag
    const result = await markLeadAsCalled(leadId, { ...callDetails, reset });
    res.json(result);
  } catch (error) {
    console.error('Error marking lead as called:', error);
    res.status(500).json({ error: 'Failed to mark lead as called' });
  }
});

// Update interest status for a lead
router.post('/lead/:leadId/interest-status', async (req, res) => {
  // Add CORS headers
  addCorsHeaders(res, req.headers.origin);
  
  const { leadId } = req.params;
  const { interestStatus } = req.body;
  
  if (!leadId) {
    return res.status(400).json({ error: 'Lead ID is required' });
  }
  
  if (!interestStatus || !['green', 'yellow', 'red'].includes(interestStatus)) {
    return res.status(400).json({ error: 'Valid interest status (green, yellow, red) is required' });
  }
  
  try {
    // Get the most recent call for this lead
    const { data: callData, error: callError } = await supabase
      .from('call_tracking')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (callError) {
      console.error('Error fetching call data:', callError);
      return res.status(500).json({ error: 'Failed to fetch call data' });
    }
    
    if (!callData || callData.length === 0) {
      return res.status(404).json({ error: 'No call found for this lead' });
    }
    
    // Update the interest status
    const { error: updateError } = await supabase
      .from('call_tracking')
      .update({ interest_status: interestStatus })
      .eq('id', callData[0].id);
    
    if (updateError) {
      console.error('Error updating interest status:', updateError);
      return res.status(500).json({ error: 'Failed to update interest status' });
    }
    
    return res.status(200).json({ 
      success: true, 
      message: `Interest status updated to ${interestStatus}` 
    });
  } catch (error) {
    console.error('Error updating interest status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Special debugging endpoint for CORS testing with calls API
router.get('/cors-check', (req, res) => {
  // Add CORS headers
  addCorsHeaders(res, req.headers.origin);
  
  console.log('CORS check for calls API', {
    origin: req.headers.origin,
    method: req.method,
    path: req.path,
    host: req.headers.host,
  });
  
  return res.json({
    success: true,
    message: 'CORS check successful for calls API',
    timestamp: new Date().toISOString(),
    headers: {
      cors: {
        origin: res.getHeader('Access-Control-Allow-Origin'),
        methods: res.getHeader('Access-Control-Allow-Methods'),
        headers: res.getHeader('Access-Control-Allow-Headers'),
        credentials: res.getHeader('Access-Control-Allow-Credentials')
      },
      received: {
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer
      }
    }
  });
});

// Debug route for API path recognition testing
router.post('/debug', (req, res) => {
  // Add CORS headers
  addCorsHeaders(res, req.headers.origin);
  
  console.log('Debug call API request received:');
  console.log('- Headers:', req.headers);
  console.log('- Body:', req.body);
  
  return res.json({
    success: true,
    message: 'Debug call API request received',
    requestDetails: {
      headers: req.headers,
      body: req.body
    }
  });
});

module.exports = router; 