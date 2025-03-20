const express = require('express');
const { 
  placeCall, 
  handleCallStatus, 
  handleRecording,
  getTwiMlForTracking,
  getCallStatus,
  createVapiBridge,
  handleVapiWebhook
} = require('../services/callService.js');
const { supabase } = require('../config/supabase.js');
const callValidation = require('../middleware/callValidation');
const { createClient } = require('@supabase/supabase-js');

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

/**
 * Place an outbound call
 */
router.post('/', async (req, res) => {
  try {
    const { 
      phone_number, 
      lead, 
      script, 
      lead_sequence_id, 
      step_id 
    } = req.body;
    
    console.log(`Call request received for ${phone_number}`, { 
      lead_id: lead?.id,
      lead_sequence_id,
      step_id
    });
    
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    
    if (!lead || !lead.id) {
      return res.status(400).json({ error: 'Lead information is required' });
    }
    
    if (!script) {
      return res.status(400).json({ error: 'Call script is required' });
    }
    
    const result = await placeCall(phone_number, lead, script, lead_sequence_id, step_id);
    
    // Handle case where there was a Twilio error but we returned a simulated response
    if (result.error) {
      res.status(200).json({ 
        success: true, 
        warning: 'Call simulated - Twilio error', 
        error_details: result.error,
        result: result
      });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Call API error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/v1/calls/place
 * @desc Place an outbound call to a lead using VAPI
 * @access Private
 */
router.post('/place', callValidation.validateOutboundCall, async (req, res) => {
  try {
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
    
    // Place the call
    const result = await placeCall(phone_number, processedScript, leadData);
    
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
        const result = await placeCall(firstLead.phone, processedScript, leadData);
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
 * @desc Handle VAPI webhooks
 * @access Public
 */
router.post('/vapi-webhook', async (req, res) => {
  try {
    console.log('Received VAPI webhook:', JSON.stringify(req.body, null, 2));
    
    // Process the webhook
    await handleVapiWebhook(req.body);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Error processing VAPI webhook:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process webhook'
    });
  }
});

/**
 * @route GET /api/v1/calls/status/:callId
 * @desc Get the status of a call by ID
 */
router.get('/status/:callId', async (req, res) => {
  try {
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
 * Get call history for a lead
 */
router.get('/history/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    
    if (!supabase) {
      console.warn('Supabase client not available, returning mock call history');
      // Return mock data for development
      return res.json({
        success: true,
        calls: [
          {
            id: 'mock-call-1',
            lead_id: leadId,
            call_id: 'mock-vapi-call-1',
            status: 'completed',
            created_at: new Date().toISOString(),
            conversations: [
              {
                transcript: 'This is a mock transcript for development.',
                recording_url: 'https://example.com/mock-recording.mp3'
              }
            ]
          }
        ]
      });
    }
    
    const { data, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        conversations:call_conversations(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching call history:', error);
      throw error;
    }
    
    res.json({
      success: true,
      calls: data
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history',
      error: error.message
    });
  }
});

/**
 * Fetch lead data from Supabase
 * @param {string} leadId - The ID of the lead
 * @returns {Promise<object>} - The lead data
 */
async function fetchLeadData(leadId) {
  try {
    // If no leadId provided, return null
    if (!leadId) {
      console.warn('No lead ID provided to fetchLeadData');
      return null;
    }
    
    // Use main supabase client from config
    if (!supabase) {
      console.warn('Supabase client not available, returning mock lead data');
      // For development, we can return mock data when Supabase is not configured
      return {
        id: leadId,
        first_name: 'Test',
        last_name: 'User',
        company_name: 'Test Company',
        email: 'test@example.com',
        phone: '+12345678900',
        title: 'Test Title'
      };
    }
    
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();
    
    if (error) {
      console.error('Error fetching lead data:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error in fetchLeadData:', error);
    return null;
  }
}

/**
 * Process the call script and replace placeholders with lead data
 * @param {object} script - The call script
 * @param {object} leadData - The lead data
 * @returns {object} - The processed script
 */
function processScript(script, leadData) {
  if (!script || !leadData) return script;
  
  const processString = (str) => {
    if (!str) return str;
    
    return str
      .replace(/{{name}}/g, `${leadData.first_name} ${leadData.last_name}`)
      .replace(/{{firstName}}/g, leadData.first_name)
      .replace(/{{lastName}}/g, leadData.last_name)
      .replace(/{{company}}/g, leadData.company_name || 'your company')
      .replace(/{{title}}/g, leadData.title || 'your role')
      .replace(/{{email}}/g, leadData.email || 'your email');
  };
  
  const processedScript = { ...script };
  
  // Process greeting and introduction
  processedScript.greeting = processString(script.greeting);
  processedScript.introduction = processString(script.introduction);
  processedScript.closing = processString(script.closing);
  
  // Process talking points
  if (Array.isArray(script.talking_points)) {
    processedScript.talking_points = script.talking_points.map(point => processString(point));
  }
  
  // Process questions
  if (Array.isArray(script.questions)) {
    processedScript.questions = script.questions.map(question => processString(question));
  }
  
  return processedScript;
}

// Test VAPI configuration
router.post('/test-vapi', async (req, res) => {
  try {
    // Get phone number from request or use a default
    const { phone_number } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required for testing'
      });
    }
    
    console.log(`Testing VAPI configuration with phone number: ${phone_number}`);
    
    // Call the test function
    const result = await callService.testVapiConfiguration(phone_number);
    
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

module.exports = router; 