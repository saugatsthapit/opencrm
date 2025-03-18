const { supabase } = require('../config/supabase.js');
const dotenv = require('dotenv');
const { VapiClient } = require('@vapi-ai/server-sdk');
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

// Initialize VAPI client with API key
const vapiClient = new VapiClient({ token: VAPI_API_KEY });

// Track call statuses in memory for quick access
const callStatusMap = new Map();

// Add this function to get a proper webhook URL that works with external services
const getPublicWebhookUrl = (path) => {
  const configuredUrl = process.env.VITE_APP_URL;
  // If the URL is localhost or not set, use the production URL
  if (!configuredUrl || configuredUrl.includes('localhost')) {
    return `https://fastcrm.netlify.app${path}`;
  }
  return `${configuredUrl}${path}`;
};

/**
 * Place an outbound call using VAPI (Voice AI API)
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

    if (!VAPI_API_KEY) {
      throw new Error('VAPI API key is required for cold calling. Please set VITE_VAPI_API_KEY in your .env file.');
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

    // Format greeting with variable substitution
    let greeting = callScript.greeting || `Hello, I'm calling about our CRM software that can help improve your team's productivity.`;
    
    // Replace variables in the greeting
    const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
    greeting = greeting.replace(/{{firstName}}/g, lead.first_name || '')
                      .replace(/{{lastName}}/g, lead.last_name || '')
                      .replace(/{{name}}/g, leadName)
                      .replace(/{{company}}/g, lead.company_name || 'your company');

    // Webhook configuration for receiving call events
    const webhookUrl = getPublicWebhookUrl('/api/v1/calls/vapi-webhook');
    console.log(`Webhook URL for VAPI events: ${webhookUrl}`);
    
    // Check if real calls are enabled (either in production or explicitly enabled)
    const enableRealCalls = process.env.NODE_ENV === 'production' || process.env.VITE_ENABLE_REAL_CALLS === 'true';
    
    let callData;
    
    if (enableRealCalls) {
      try {
        console.log('Making REAL call to', phone_number);
        
        // Make the call using VAPI SDK
        callData = await vapiClient.calls.create({
          // Call details
          name: `Call to ${leadName || phone_number}`,
          
          // Create a transient assistant
          assistant: {
            name: `Cold Call Assistant for ${leadName || 'Lead'}`,
            firstMessage: greeting,
            firstMessageMode: "assistant-speaks-first",
            
            // Voice configuration
            voice: {
              provider: "eleven-labs",  // Or another provider like "azure"
              voiceId: callScript.voice || "shimmer" 
            },
            
            // Model configuration
            model: {
              provider: "openai",
              model: callScript.ai_model || "gpt-4",
              // Add instructions based on the call script
              messages: [
                {
                  role: "system",
                  content: `You are a professional cold caller for a CRM software company. 
You're calling ${leadName || 'a potential customer'} at ${lead.company_name || 'a company'}.
Here's your script:
- Introduction: ${callScript.introduction || ''}
- Talking Points: ${callScript.talking_points ? callScript.talking_points.join(', ') : ''}
- Questions to Ask: ${callScript.questions ? callScript.questions.join(', ') : ''}
- Closing Message: ${callScript.closing || ''}

Remember to:
1. Be professional and courteous
2. Listen carefully to responses
3. Address any concerns
4. Avoid being too pushy
5. Collect relevant information about their needs
6. Clearly explain the next steps if they're interested

First, introduce yourself and the purpose of your call. Then, proceed with the conversation.`
                }
              ]
            },
            
            // Maximum duration in seconds
            maxDurationSeconds: 600,
            
            // Timeout if nobody speaks for 30 seconds
            silenceTimeoutSeconds: 30,
            
            // Optional server webhook for real-time events
            serverMessages: ["end-of-call-report", "conversation-update", "status-update"],
            server: {
              url: webhookUrl,
              timeoutSeconds: 30
            }
          },
          
          // Customer to call
          customer: {
            number: phone_number.startsWith('+') ? phone_number : `+${phone_number}`,
            name: leadName || 'Lead',
            // Pass additional context as metadata
            metadata: {
              lead_id: lead.id,
              tracking_id: tracking.tracking_id,
              lead_sequence_id: leadSequenceId || null,
              step_id: stepId || null
            }
          }
        });
        
        console.log('VAPI call successfully initiated:', callData);
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
    
    console.log(`Processing VAPI bridge request for tracking ID: ${trackingId}`);
    
    // Check memory first for configs
    let vapiConfig = callStatusMap.get(`config_${trackingId}`);
    let trackingInfo = callStatusMap.get(`tracking_${trackingId}`);
    
    if (vapiConfig) {
      console.log('Found VAPI config in memory cache for:', trackingId);
      console.log('VAPI config contents:', JSON.stringify(vapiConfig));
    }
    
    if (trackingInfo) {
      console.log('Found tracking info in memory cache for:', trackingId);
    }
    
    // Fetch the tracking record with VAPI config
    const { data, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        lead:leads(*)
      `)
      .eq('tracking_id', trackingId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors
    
    if (error || !data) {
      console.warn(`No tracking record found in database for tracking ID: ${trackingId}`);
      console.log('Attempting to use memory-cached data instead');
      
      // If we have some configuration in memory, use that
      if (vapiConfig) {
        console.log('Using memory-cached config for VAPI bridge');
        // Create TwiML with proper connect/stream structure
        const VoiceResponse = twilio.twiml.VoiceResponse;
        const response = new VoiceResponse();
        
        // This is important - only a brief initial message
        response.say('Please wait while we connect you to our AI assistant.');
        
        // Setup the connect and stream for VAPI
        const connect = response.connect();
        // Make sure the URL is correctly formatted - this is key
        const streamUrl = `wss://api.vapi.ai/twilio/stream/${VAPI_API_KEY}`;
        
        console.log(`Using stream URL: ${streamUrl}`);
        
        const stream = connect.stream({
          url: streamUrl
        });
        
        // Helper function to escape XML special characters
        const escapeXml = (str) => {
          if (!str) return '';
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        };
        
        // Add parameters with proper escaping
        stream.parameter({
          name: 'first_message',
          value: escapeXml(vapiConfig.first_message || 'Hello, how can I help you today?')
        });
        
        stream.parameter({
          name: 'voice',
          value: escapeXml(vapiConfig.voice || 'shimmer')
        });
        
        stream.parameter({
          name: 'model',
          value: escapeXml(vapiConfig.model || 'gpt-4')
        });
        
        // Make sure context is properly stringified and escaped
        const contextValue = typeof vapiConfig.context === 'string' 
          ? vapiConfig.context 
          : JSON.stringify(vapiConfig.context || {});
          
        stream.parameter({
          name: 'context',
          value: escapeXml(contextValue)
        });
        
        // Add call_id parameter if we have a tracking id
        if (trackingInfo && trackingInfo.call_id) {
          stream.parameter({
            name: 'call_id',
            value: trackingInfo.call_id
          });
        }
        
        const finalTwiML = response.toString();
        console.log('Generated VAPI bridge TwiML:', finalTwiML);
        
        return {
          twiml: finalTwiML
        };
      }
      
      // If all else fails, return a default response
      return {
        error: 'No configuration found for this call',
        twiml: `
          <Response>
            <Say>We could not find your specific configuration. Ending the call.</Say>
          </Response>
        `
      };
    }
    
    // We found the tracking record in the database
    console.log('Found tracking record in database:', data.id);
    const phone_number = data.phone_number;
    
    // If we don't have vapiConfig from memory, get it from the database
    if (!vapiConfig) {
      vapiConfig = data.vapi_config || {};
      
      // If still not found, create a minimal default config
      if (Object.keys(vapiConfig).length === 0) {
        console.log('No VAPI config found, creating minimal default');
        vapiConfig = {
          model: 'gpt-4',
          voice: 'shimmer',
          first_message: 'Hello, I am calling on behalf of FastCRM. How are you today?',
          context: '{}'
        };
      }
    }

    // Helper function to escape XML special characters
    const escapeXml = (str) => {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    // Create a proper Twilio Response object using the twilio library
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    
    // Brief initial greeting
    response.say('Please wait while we connect you to our AI assistant.');
    
    // Create Connect verb with Stream - this is how we connect to VAPI
    const connect = response.connect();
    
    // This is the correct format for the VAPI stream URL - without tracking ID in path
    const streamUrl = `wss://api.vapi.ai/twilio/stream/${VAPI_API_KEY}`;
    console.log(`Using stream URL: ${streamUrl}`);
    
    const stream = connect.stream({
      url: streamUrl
    });
    
    // Add parameters with proper escaping
    stream.parameter({
      name: 'first_message',
      value: escapeXml(vapiConfig.first_message || 'Hello, how can I help you today?')
    });
    
    stream.parameter({
      name: 'voice',
      value: escapeXml(vapiConfig.voice || 'shimmer')
    });
    
    stream.parameter({
      name: 'model',
      value: escapeXml(vapiConfig.model || 'gpt-4')
    });
    
    // Make sure context is properly stringified and escaped
    const contextValue = typeof vapiConfig.context === 'string' 
      ? vapiConfig.context 
      : JSON.stringify(vapiConfig.context || {});
      
    stream.parameter({
      name: 'context',
      value: escapeXml(contextValue)
    });
    
    // Add call_id parameter if we have one
    if (data.call_id) {
      stream.parameter({
        name: 'call_id',
        value: data.call_id
      });
    }
    
    const finalTwiML = response.toString();
    console.log('Generated VAPI bridge TwiML:', finalTwiML);
    
    // Return the TwiML
    return {
      twiml: finalTwiML
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
    
    // Better logging of complete webhook data
    console.log(`Received call status webhook for call ${CallSid}:`, JSON.stringify(statusData, null, 2));
    
    // If CallSid is missing, we can't do anything
    if (!CallSid) {
      console.warn('Received call status webhook without CallSid, ignoring');
      return;
    }
    
    // Update in-memory status
    const callInfo = callStatusMap.get(CallSid);
    if (callInfo) {
      callInfo.status = CallStatus;
      if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
        callInfo.completed = true;
      }
      
      // If we have the tracking_id in memory but not in the database, try to update it now
      if (callInfo.tracking_id) {
        console.log(`Updating call_tracking with saved tracking_id ${callInfo.tracking_id} for call ${CallSid}`);
        try {
          const { data, error } = await supabase
            .from('call_tracking')
            .update({ tracking_id: callInfo.tracking_id })
            .eq('call_id', CallSid)
            .select('id')
            .maybeSingle();
          
          if (!error && data) {
            console.log(`Successfully updated tracking_id for call ${CallSid}`);
          }
        } catch (err) {
          console.warn(`Failed to update tracking_id for call ${CallSid}:`, err.message);
        }
      }
    } else {
      console.warn(`No in-memory call info found for CallSid: ${CallSid}`);
    }
    
    // Try to find the tracking record in the database
    const { data: trackingData, error: findError } = await supabase
      .from('call_tracking')
      .select('id, tracking_id, lead_sequence_id, step_id')
      .eq('call_id', CallSid)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors
    
    if (findError || !trackingData) {
      console.warn(`No call tracking record found for CallSid: ${CallSid}. This is expected for initial calls.`);
      
      // If we don't have a tracking record yet, let's try to create one with basic info
      if (CallStatus && CallStatus !== 'unknown') {
        try {
          const { data, error } = await supabase
            .from('call_tracking')
            .insert({
              call_id: CallSid,
              status: CallStatus,
              tracking_id: `autogen-${CallSid.substring(0, 8)}`, // Generate a tracking ID based on CallSid
              duration: CallDuration ? parseInt(CallDuration) : null,
              recording_url: RecordingUrl || null,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (!error) {
            console.log(`Created new call tracking record for CallSid: ${CallSid}`);
          } else {
            console.error('Error creating call tracking record:', error);
          }
        } catch (err) {
          console.error('Failed to create tracking record:', err.message);
        }
      }
      
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
    } else if (CallStatus === 'in-progress' && !trackingData.started_at) {
      updateData.started_at = new Date().toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('call_tracking')
      .update(updateData)
      .eq('id', trackingData.id);
    
    if (updateError) {
      console.error('Error updating call tracking status:', updateError);
    } else {
      console.log(`Successfully updated status to ${CallStatus} for call ${CallSid}`);
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
    console.log('Received VAPI webhook:', JSON.stringify(webhookData, null, 2));
    
    const { id: call_id, status, customer, artifact } = webhookData;
    
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
    
    // Try to find the tracking record - first check if customer metadata has tracking_id
    let tracking_id = null;
    if (customer && customer.metadata && customer.metadata.tracking_id) {
      tracking_id = customer.metadata.tracking_id;
    } else if (callInfo) {
      tracking_id = callInfo.tracking_id;
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
          // If we have the tracking_id from metadata, use it to find the tracking record
          let existingRecord = null;
          if (tracking_id) {
            const { data } = await supabase
              .from('call_tracking')
              .select('id')
              .eq('tracking_id', tracking_id)
              .maybeSingle();
            
            if (data) {
              existingRecord = data;
              // Update with the call_id
              await supabase
                .from('call_tracking')
                .update({ 
                  call_id: call_id,
                  status: status
                })
                .eq('id', existingRecord.id);
              
              console.log(`Updated existing tracking record with call_id: ${call_id}`);
            }
          }
          
          // If no existing record, create a new one
          if (!existingRecord) {
            const { data, error } = await supabase
              .from('call_tracking')
              .insert({
                call_id: call_id,
                status: status,
                tracking_id: tracking_id || `vapi-${call_id.substring(0, 8)}`,
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
          } else {
            trackingData = existingRecord;
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