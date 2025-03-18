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

const router = express.Router();

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
 * @desc Place a new outbound call to a lead
 */
router.post('/place', async (req, res) => {
  try {
    const { phone_number, lead_id, lead_sequence_id, step_id, call_script } = req.body;
    
    if (!phone_number || !lead_id) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and lead ID are required'
      });
    }
    
    // Fetch lead data from Supabase
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();
    
    if (leadError) {
      console.error('Error fetching lead data:', leadError);
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }
    
    console.log(`Call request received for ${phone_number}`, {
      lead_id,
      lead_sequence_id,
      step_id
    });
    
    const callResult = await placeCall(
      phone_number,
      lead,
      call_script,
      lead_sequence_id,
      step_id
    );
    
    return res.status(201).json({
      success: true,
      data: callResult
    });
  } catch (error) {
    console.error('Error in /calls/place:', error);
    return res.status(500).json({
      success: false,
      message: error.message
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
 * @desc Webhook endpoint for receiving VAPI call events
 */
router.post('/vapi-webhook', async (req, res) => {
  try {
    console.log('VAPI webhook received:', req.body);
    
    // Process the webhook asynchronously
    handleVapiWebhook(req.body).catch(error => {
      console.error('Error processing VAPI webhook:', error);
    });
    
    // Return immediately with 200 OK to acknowledge receipt
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in VAPI webhook handler:', error);
    // Still return 200 to prevent VAPI from retrying
    return res.status(200).json({ 
      success: false, 
      message: 'Webhook received but error during processing' 
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
    
    const { data, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        conversations:call_conversations(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    
    if (error) {
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

module.exports = router; 