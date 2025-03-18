const { supabase } = require('../config/supabase.js');
const dotenv = require('dotenv');
const twilio = require('twilio');
const fetch = require('node-fetch');

dotenv.config();

const VAPI_API_KEY = process.env.VITE_VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai/call';
const PHONE_SERVICE_API_KEY = process.env.VITE_PHONE_SERVICE_API_KEY;

// Initialize Twilio client with your credentials
const twilioClient = twilio(
  process.env.VITE_TWILIO_ACCOUNT_SID,
  process.env.VITE_TWILIO_AUTH_TOKEN
);
const TWILIO_PHONE_NUMBER = process.env.VITE_TWILIO_PHONE_NUMBER;

// Track call statuses in memory for quick access
const callStatusMap = new Map();

// Add this function to get a proper webhook URL that works with Twilio
const getPublicWebhookUrl = (path) => {
  const configuredUrl = process.env.VITE_APP_URL;
  // If the URL is localhost or not set, use the production URL
  if (!configuredUrl || configuredUrl.includes('localhost')) {
    return `https://fastcrm.netlify.app${path}`;
  }
  return `${configuredUrl}${path}`;
};

/**
 * Place an outbound call using Twilio but VAPI for voice AI
 * @param {string} phone_number - The phone number to call
 * @param {object} lead - The lead data for the call
 * @param {object} callScript - The call script configuration
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

    // Create tracking record
    let tracking;
    try {
      const { data, error } = await supabase
        .from('call_tracking')
        .insert({
          lead_sequence_id: leadSequenceId,
          step_id: stepId,
          phone_number,
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
            p_phone_number: phone_number,
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
        phone_number,
        lead_id: lead.id
      };
      console.log('Using local tracking as fallback:', tracking);
    }

    // Prepare the assistant's context with lead information
    const assistantContext = {
      lead: {
        name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        firstName: lead.first_name || '',
        lastName: lead.last_name || '',
        company: lead.company_name || '',
        title: lead.title || '',
        email: lead.email || '',
        location: lead.location || ''
      },
      script: {
        introduction: callScript.introduction || '',
        talking_points: callScript.talking_points || [],
        questions: callScript.questions || [],
        closing: callScript.closing || ''
      },
      tracking_id: tracking.tracking_id
    };

    let callData;
    
    // HYBRID APPROACH: Use VAPI for voice AI but initiate via webhook
    if (VAPI_API_KEY) {
      // Create a webhook URL that will trigger VAPI when Twilio connects the call
      const localWebhookUrl = `${process.env.VITE_APP_URL}/api/v1/calls/vapi-bridge/${tracking.tracking_id}`;
      // Get a public URL that Twilio can access
      const webhookUrl = getPublicWebhookUrl(`/api/v1/calls/vapi-bridge/${tracking.tracking_id}`);
      
      // For development with localhost, provide clear guidance
      if (process.env.VITE_APP_URL && process.env.VITE_APP_URL.includes('localhost')) {
        console.warn('⚠️ Local URL detected but using production URL for Twilio webhooks');
        console.warn(`Local URL: ${localWebhookUrl}`);
        console.warn(`Production URL for Twilio: ${webhookUrl}`);
      }
      
      console.log(`Webhook URL for VAPI bridge: ${webhookUrl}`);
      
      // Store VAPI configuration for later use in the bridge
      const vapiConfig = {
        model: callScript.ai_model || 'gpt-4',
        voice: callScript.voice || 'shimmer',
        first_message: callScript.greeting || `Hello, this is calling about ${assistantContext.script.introduction}`,
        context: JSON.stringify(assistantContext)
      };
      
      // Store in call_tracking for later retrieval if the column exists
      if (tracking.id) {
        try {
          const { error: updateError } = await supabase
            .from('call_tracking')
            .update({ 
              vapi_config: vapiConfig
            })
            .eq('id', tracking.id);

          if (updateError) {
            // If the column doesn't exist, simply log it but continue
            if (updateError.code === 'PGRST204') {
              console.log('Note: vapi_config column not found in call_tracking table. Storing config in memory only.');
              // Store in memory instead
              callStatusMap.set(`config_${tracking.tracking_id}`, vapiConfig);
            } else {
              console.error('Failed to update call tracking with VAPI config:', updateError);
            }
          }
        } catch (err) {
          console.log('Error updating vapi_config, continuing with in-memory storage:', err.message);
          // Store in memory instead
          callStatusMap.set(`config_${tracking.tracking_id}`, vapiConfig);
        }
      }
      
      console.log('Using hybrid approach: Twilio for call, VAPI for conversation');
      
      // Check if real calls are enabled (either in production or explicitly enabled)
      const enableRealCalls = process.env.NODE_ENV === 'production' || process.env.VITE_ENABLE_REAL_CALLS === 'true';
      
      if (enableRealCalls) {
        // Use Twilio to initiate the call
        console.log(`Making REAL Twilio call to ${phone_number} from ${TWILIO_PHONE_NUMBER}`);
        try {
          const call = await twilioClient.calls.create({
            to: phone_number,
            from: TWILIO_PHONE_NUMBER,
            url: webhookUrl,
            statusCallback: getPublicWebhookUrl('/api/v1/calls/status'),
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST',
            record: true
          });
          callData = {
            id: call.sid,
            status: call.status,
            created_at: new Date().toISOString()
          };
          console.log('Real call initiated successfully:', call.sid);
        } catch (twilioError) {
          console.error('Twilio call error:', twilioError);
          // Fall back to simulation if Twilio fails
          console.log('FALLBACK: Simulating Twilio call due to error');
          callData = {
            id: `call_${Date.now()}`,
            status: 'queued',
            created_at: new Date().toISOString(),
            error: twilioError.message
          };
        }
      } else {
        // Simulated response for development
        console.log('DEVELOPMENT MODE: Simulating Twilio call with VAPI instead of making real call');
        callData = {
          id: `call_${Date.now()}`,
          status: 'queued',
          created_at: new Date().toISOString()
        };
      }
    } else {
      // Fallback to basic TwiML if VAPI is not configured
      console.log('No VAPI API key found. Using basic TwiML instead.');
      
      // Generate basic TwiML for the call
      const localTwimlUrl = `${process.env.VITE_APP_URL}/api/v1/calls/twiml/${tracking.tracking_id}`;
      // Get a public URL that Twilio can access
      const twimlBinUrl = getPublicWebhookUrl(`/api/v1/calls/twiml/${tracking.tracking_id}`);
      
      // For development with localhost, provide clear guidance
      if (process.env.VITE_APP_URL && process.env.VITE_APP_URL.includes('localhost')) {
        console.warn('⚠️ Local URL detected but using production URL for Twilio webhooks');
        console.warn(`Local URL: ${localTwimlUrl}`);
        console.warn(`Production URL for Twilio: ${twimlBinUrl}`);
      }
      
      console.log(`TwiML URL: ${twimlBinUrl}`);
      
      // Check if real calls are enabled (either in production or explicitly enabled)
      const enableRealCalls = process.env.NODE_ENV === 'production' || process.env.VITE_ENABLE_REAL_CALLS === 'true';
      
      if (enableRealCalls) {
        // Use Twilio to initiate the call
        console.log(`Making REAL Twilio call to ${phone_number} from ${TWILIO_PHONE_NUMBER}`);
        try {
          const call = await twilioClient.calls.create({
            to: phone_number,
            from: TWILIO_PHONE_NUMBER,
            url: twimlBinUrl,
            statusCallback: getPublicWebhookUrl('/api/v1/calls/status'),
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
            statusCallbackMethod: 'POST',
            record: true
          });
          callData = {
            id: call.sid,
            status: call.status,
            created_at: new Date().toISOString()
          };
          console.log('Real call initiated successfully:', call.sid);
        } catch (twilioError) {
          console.error('Twilio call error:', twilioError);
          // Fall back to simulation if Twilio fails
          console.log('FALLBACK: Simulating Twilio call due to error');
          callData = {
            id: `call_${Date.now()}`,
            status: 'queued',
            created_at: new Date().toISOString(),
            error: twilioError.message
          };
        }
      } else {
        // Simulated response for development
        console.log('DEVELOPMENT MODE: Simulating Twilio call instead of making real call');
        callData = {
          id: `call_${Date.now()}`,
          status: 'queued',
          created_at: new Date().toISOString()
        };
      }
    }
    
    console.log('Call initiated:', callData);
    
    // Update tracking record with call ID
    if (tracking.id) {
      const { error: updateError } = await supabase
        .from('call_tracking')
        .update({ 
          call_id: callData.id,
          status: callData.status,
          started_at: new Date().toISOString()
        })
        .eq('id', tracking.id);

      if (updateError) {
        console.error('Failed to update call tracking record:', updateError);
      }
    }
    
    // Store in memory for quick access
    callStatusMap.set(callData.id, {
      status: callData.status,
      tracking_id: tracking.tracking_id,
      lead_sequence_id: leadSequenceId,
      step_id: stepId
    });

    console.log(`Call initiated with ID: ${callData.id}`);
    return { ...tracking, call_id: callData.id, call_status: callData.status };
  } catch (error) {
    console.error('Error in placeCall:', error);
    throw error;
  }
};

/**
 * Get TwiML for a specific tracking ID (fallback if VAPI not used)
 * @param {string} trackingId - The tracking ID
 * @returns {string} - The TwiML for the call
 */
const getTwiMlForTracking = async (trackingId) => {
  try {
    // Try to fetch the tracking record and related data
    const { data, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        lead:leads(*)
      `)
      .eq('tracking_id', trackingId)
      .single();
    
    if (error) {
      console.error('Error fetching tracking record for TwiML:', error);
      // Return a simple TwiML as fallback
      return `
        <Response>
          <Say>Hello, this is an automated call. We're sorry, but we couldn't load your personalized script.</Say>
        </Response>
      `;
    }
    
    // Create a simple TwiML for this demo
    return `
      <Response>
        <Say>Hello, this is an automated call for ${data.lead.first_name || 'you'}. This is a test of our cold calling system.</Say>
        <Pause length="1"/>
        <Say>Thank you for your time. Have a great day!</Say>
      </Response>
    `;
  } catch (error) {
    console.error('Error generating TwiML:', error);
    return `
      <Response>
        <Say>Hello, this is an automated call. We're sorry, but an error occurred.</Say>
      </Response>
    `;
  }
};

/**
 * Bridge to VAPI - used in hybrid approach
 * @param {string} trackingId - The tracking ID to get VAPI config for
 * @returns {object} - The VAPI call details
 */
const createVapiBridge = async (trackingId) => {
  try {
    if (!VAPI_API_KEY) {
      console.error('VAPI API key not configured');
      return {
        error: 'VAPI API key not configured',
        twiml: `
          <Response>
            <Say>We're sorry, but the voice AI service is not configured properly.</Say>
          </Response>
        `
      };
    }
    
    // Fetch the tracking record with VAPI config
    const { data, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        lead:leads(*)
      `)
      .eq('tracking_id', trackingId)
      .single();
    
    if (error) {
      console.error('Error fetching call details for VAPI bridge:', error);
      return {
        error: 'Failed to fetch call details',
        twiml: `
          <Response>
            <Say>We're sorry, but we couldn't load your call details.</Say>
          </Response>
        `
      };
    }
    
    const phone_number = data.phone_number;
    let vapiConfig = data.vapi_config || {};
    
    // If not found in database, try to get from memory
    if (Object.keys(vapiConfig).length === 0) {
      const memoryConfig = callStatusMap.get(`config_${trackingId}`);
      if (memoryConfig) {
        console.log('Retrieved VAPI config from memory for:', trackingId);
        vapiConfig = memoryConfig;
      }
    }
    
    // This TwiML will bridge the call to VAPI
    return {
      twiml: `
        <Response>
          <Say>Please wait while we connect you with our AI assistant.</Say>
          <Connect>
            <Stream url="wss://api.vapi.ai/twilio/stream/${VAPI_API_KEY}/${trackingId}">
              <Parameter name="first_message" value="${vapiConfig.first_message || 'Hello, how can I help you today?'}"/>
              <Parameter name="voice" value="${vapiConfig.voice || 'shimmer'}"/>
              <Parameter name="model" value="${vapiConfig.model || 'gpt-4'}"/>
              <Parameter name="context" value="${vapiConfig.context || '{}'}"/>
            </Stream>
          </Connect>
        </Response>
      `
    };
  } catch (error) {
    console.error('Error creating VAPI bridge:', error);
    return {
      error: 'Failed to create VAPI bridge',
      twiml: `
        <Response>
          <Say>We're sorry, but an error occurred while connecting to our AI assistant.</Say>
        </Response>
      `
    };
  }
};

/**
 * Handle call status webhook from Twilio
 * @param {object} statusData - The status data from the webhook
 */
const handleCallStatus = async (statusData) => {
  try {
    const { CallSid, CallStatus, RecordingUrl, CallDuration } = statusData;
    console.log(`Received call status update for call ${CallSid}: ${CallStatus}`);
    
    // Update in-memory status
    const callInfo = callStatusMap.get(CallSid);
    if (callInfo) {
      callInfo.status = CallStatus;
      if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
        callInfo.completed = true;
      }
    }
    
    // Update database
    const { data: trackingData, error: findError } = await supabase
      .from('call_tracking')
      .select('id, tracking_id, lead_sequence_id, step_id')
      .eq('call_id', CallSid)
      .single();
    
    if (findError) {
      console.error('Error finding call tracking record:', findError);
      return;
    }
    
    const updateData = {
      status: CallStatus,
      duration: CallDuration ? parseInt(CallDuration) : null,
      recording_url: RecordingUrl || null
    };
    
    if (CallStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
      updateData.failed_at = new Date().toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('call_tracking')
      .update(updateData)
      .eq('id', trackingData.id);
    
    if (updateError) {
      console.error('Error updating call tracking status:', updateError);
    }
  } catch (error) {
    console.error('Error handling call status:', error);
  }
};

/**
 * Process Twilio recording webhook
 * @param {object} recordingData - The recording data from the webhook
 */
const handleRecording = async (recordingData) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingStatus } = recordingData;
    
    if (RecordingStatus !== 'completed') {
      return; // Only process completed recordings
    }
    
    console.log(`Received recording for call ${CallSid}: ${RecordingUrl}`);
    
    // Update database with recording URL
    const { data: trackingData, error: findError } = await supabase
      .from('call_tracking')
      .select('id')
      .eq('call_id', CallSid)
      .single();
    
    if (findError) {
      console.error('Error finding call tracking record for recording:', findError);
      return;
    }
    
    // Create a conversation record with the recording
    const { error: insertError } = await supabase
      .from('call_conversations')
      .insert({
        call_tracking_id: trackingData.id,
        recording_id: RecordingSid,
        recording_url: RecordingUrl,
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Error storing call recording:', insertError);
    }
  } catch (error) {
    console.error('Error handling recording webhook:', error);
  }
};

/**
 * Handle call webhook from VAPI (conversation updates)
 * @param {object} webhookData - The webhook data from VAPI
 */
const handleVapiWebhook = async (webhookData) => {
  try {
    console.log('Received VAPI webhook:', webhookData);
    
    const { call_id, transcript, conversation } = webhookData;
    
    // If there's no call_id, we can't process this webhook
    if (!call_id) {
      console.error('No call_id in VAPI webhook data');
      return;
    }
    
    // Find the tracking record by call_id
    const { data: trackingData, error: findError } = await supabase
      .from('call_tracking')
      .select('id')
      .eq('call_id', call_id)
      .single();
    
    if (findError) {
      console.error('Error finding call tracking record for VAPI webhook:', findError);
      return;
    }
    
    // Store the conversation data
    const { error: insertError } = await supabase
      .from('call_conversations')
      .insert({
        call_tracking_id: trackingData.id,
        transcript: transcript,
        conversation_data: conversation,
        created_at: new Date().toISOString()
      });
    
    if (insertError) {
      console.error('Error storing VAPI conversation:', insertError);
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

// Export all functions using CommonJS syntax
module.exports = {
  placeCall,
  getTwiMlForTracking,
  createVapiBridge,
  handleCallStatus,
  handleRecording,
  handleVapiWebhook,
  getCallStatus
}; 