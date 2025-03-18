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
 * Legacy route for backwards compatibility
 */
router.post('/place', async (req, res) => {
  try {
    const { phone_number, lead_id, script, lead_sequence_id, step_id } = req.body;
    
    // Get lead data if lead_id is provided
    let lead = req.body.lead;
    if (!lead && lead_id) {
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, title, company_name, location, linkedin, phone')
        .eq('id', lead_id)
        .single();
        
      if (error) {
        throw new Error(`Error fetching lead: ${error.message}`);
      }
      lead = data;
    }
    
    if (!lead) {
      throw new Error('Lead data is required');
    }
    
    // Use lead's phone if not provided
    const targetPhone = phone_number || lead.phone;
    if (!targetPhone) {
      throw new Error('No phone number provided and lead has no phone number');
    }
    
    const callResult = await placeCall(targetPhone, lead, script, lead_sequence_id, step_id);
    res.json({
      success: true,
      message: 'Call initiated successfully',
      call: callResult
    });
  } catch (error) {
    console.error('Error placing call:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place call',
      error: error.message
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
 * Handle VAPI webhook (conversation updates)
 */
router.post('/webhook', async (req, res) => {
  try {
    console.log('VAPI webhook received:', req.body);
    await handleVapiWebhook(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('VAPI webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get call status
 */
router.get('/status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    if (!callId) {
      return res.status(400).json({ error: 'Call ID is required' });
    }
    
    const status = await getCallStatus(callId);
    
    if (!status) {
      return res.status(404).json({ error: 'Call not found' });
    }
    
    res.json({ success: true, status });
  } catch (error) {
    console.error('Error fetching call status:', error);
    res.status(500).json({ error: error.message });
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