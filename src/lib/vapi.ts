import { supabase } from './supabase';
import { getApiBaseUrl as getConfigApiBaseUrl } from '../config/env';

// Determine the API base URL based on the current environment
const getApiBaseUrl = () => {
  // If we're on the production site (fastcrm.netlify.app)
  if (window.location.hostname === 'fastcrm.netlify.app') {
    // Check if the user has configured a local server with ngrok in localStorage
    const storedNgrokUrl = localStorage.getItem('ngrok_url');
    
    // Check environment variables for ngrok URL
    const envNgrokUrl = import.meta.env.VITE_NGROK_URL || import.meta.env.NGROK_URL;
    
    // Log for debugging
    console.log('NGROK URL from localStorage:', storedNgrokUrl);
    console.log('NGROK URL from env:', envNgrokUrl);
    
    const ngrokUrl = storedNgrokUrl || envNgrokUrl;
    
    if (ngrokUrl) {
      console.log(`Using configured ngrok URL: ${ngrokUrl}`);
      return `${ngrokUrl}/api/v1/calls`;
    }
    
    // Ask the user if they want to set up a ngrok URL
    setTimeout(() => {
      if (!localStorage.getItem('ngrok_prompt_shown')) {
        const ngrokUrl = prompt(
          'To test cold calling from the production site, enter your ngrok URL (e.g., https://abcd1234.ngrok.io).\n' +
          'Leave blank to skip this step.\n' +
          'You can change this later by running localStorage.setItem("ngrok_url", "your-url") in the browser console.'
        );
        
        localStorage.setItem('ngrok_prompt_shown', 'true');
        
        if (ngrokUrl) {
          localStorage.setItem('ngrok_url', ngrokUrl);
          alert(`Ngrok URL set to ${ngrokUrl}. Refresh the page to use it.`);
          window.location.reload();
        }
      }
    }, 1000);
    
    // This is where your production API would be hosted
    // For now, we'll just show an error message when trying to make calls
    console.warn('API server is not deployed for production yet. Please use the local development environment for testing or configure a ngrok URL.');
    return '/api/v1/calls'; // This will be handled by our fetch override in index.html
  }
  
  // For local development - will be proxied to localhost:8002
  return '/api/v1/calls';
};

// Get the base URL from localStorage or environment
const API_BASE_URL = getApiBaseUrl();

// Helper function to clear ngrok settings (for debugging)
export const clearNgrokSettings = () => {
  localStorage.removeItem('ngrok_url');
  localStorage.removeItem('ngrok_prompt_shown');
  alert('Ngrok settings cleared. Refresh the page to reset.');
};

// Helper function to set ngrok URL manually
export const setNgrokUrl = (url: string) => {
  localStorage.setItem('ngrok_url', url);
  alert(`Ngrok URL set to ${url}. Refresh the page to use it.`);
};

/**
 * Place a call to a lead using the configured script and Twilio
 */
export const placeCall = async (
  phoneNumber: string,
  leadId: string | object,
  script: any,
  ngrokUrl?: string,
  leadSequenceId?: string,
  stepId?: string,
  selectedAssistantId?: string
) => {
  try {
    // Check if we're on production without a properly configured ngrok
    if (window.location.hostname === 'fastcrm.netlify.app' && !localStorage.getItem('ngrok_url') && !ngrokUrl) {
      throw new Error(
        'Cold calling can only be tested from the production site with a properly configured ngrok URL. ' +
        'Please run the app locally or configure a ngrok URL by running setNgrokUrl("your-url") from the browser console.'
      );
    }
    
    // Handle both lead ID string and lead object
    let lead;
    if (typeof leadId === 'string') {
      // If leadId is a string, fetch the lead data
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (error) throw new Error(`Could not find lead: ${error.message}`);
      lead = data;
    } else {
      // If leadId is an object, it's already the lead data
      lead = leadId;
    }

    // Make sure we have a valid lead
    if (!lead) {
      throw new Error('Invalid lead data');
    }
    
    // ALWAYS use a local path that will go through Vite's proxy
    // This fixes the CORS issue by using the proxy instead of direct ngrok URL
    const baseUrl = '/api/v1/calls';
    console.log(`[vapi] Using local proxy path: ${baseUrl}`);

    console.log(`[vapi] Making call API request to: ${baseUrl}`);
    console.log(`[vapi] Request payload:`, { 
      phoneNumber, 
      leadId: lead.id, 
      scriptLength: JSON.stringify(script).length,
      selectedAssistantId
    });

    // Make API request to our endpoint
    const requestBody = {
      phone_number: phoneNumber,
      lead,
      script,
      lead_sequence_id: leadSequenceId,
      step_id: stepId,
      assistant_id: selectedAssistantId
    };
    
    console.log(`[vapi] Full request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
      credentials: 'include',
      mode: 'cors',
    });

    console.log(`[vapi] API response status:`, response.status);
    
    // For CORS errors and debugging
    if (!response.ok) {
      console.error(`[vapi] Error response:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries([...response.headers.entries()]),
      });
      
      try {
        const errorData = await response.json();
        console.error(`[vapi] Error data:`, errorData);
        throw new Error(errorData.error || `Failed to place call: ${response.statusText}`);
      } catch (jsonError) {
        // If we can't parse the JSON, just use the status text
        throw new Error(`Failed to place call (${response.status}): ${response.statusText}`);
      }
    }

    const data = await response.json();
    console.log(`[vapi] Call placed successfully:`, data);
    return data;
  } catch (error) {
    console.error('[vapi] Error placing call:', error);
    throw error;
  }
};

// For backward compatibility
export const placeCallLegacy = async (
  phoneNumber: string,
  leadId: string,
  script: any,
  ngrokUrl?: string,
  leadSequenceId?: string,
  stepId?: string
) => {
  try {
    // ALWAYS use a local path that will go through Vite's proxy
    const baseUrl = '/api/v1/calls';
    console.log(`[vapi] Using local proxy path (legacy): ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/place`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        lead_id: leadId,
        script,
        lead_sequence_id: leadSequenceId,
        step_id: stepId
      }),
      credentials: 'include',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to place call');
    }

    return await response.json();
  } catch (error) {
    console.error('[vapi] Error placing call (legacy):', error);
    throw error;
  }
};

/**
 * Get the status of a specific call
 */
export const getCallStatus = async (callId: string, ngrokUrl?: string) => {
  try {
    // ALWAYS use a local path that will go through Vite's proxy
    const baseUrl = '/api/v1/calls';
    console.log(`[vapi] Using local proxy path (getCallStatus): ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/status/${callId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get call status');
    }

    return await response.json();
  } catch (error) {
    console.error('[vapi] Error getting call status:', error);
    throw error;
  }
};

/**
 * Get call history for a specific lead
 */
export const getCallHistory = async (leadId: string, ngrokUrl?: string) => {
  try {
    // ALWAYS use a local path that will go through Vite's proxy
    const baseUrl = '/api/v1/calls';
    console.log(`[vapi] Using local proxy path (getCallHistory): ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/history/${leadId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get call history');
    }

    return await response.json();
  } catch (error) {
    console.error('[vapi] Error getting call history:', error);
    throw error;
  }
};

/**
 * Get call history directly from Supabase
 */
export const getCallHistoryFromSupabase = async (leadId: string, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('call_tracking')
      .select(`
        *,
        conversations:call_conversations(*)
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching call history from Supabase:', error);
    throw error;
  }
};

/**
 * Get call recordings for a specific call
 */
export const getCallRecordings = async (callId: string, ngrokUrl?: string) => {
  try {
    // ALWAYS use a local path that will go through Vite's proxy
    const baseUrl = '/api/v1/calls';
    console.log(`[vapi] Using local proxy path (getCallRecordings): ${baseUrl}`);
    
    const response = await fetch(`${baseUrl}/recordings/${callId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      mode: 'cors',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get call recordings');
    }

    return await response.json();
  } catch (error) {
    console.error('[vapi] Error getting call recordings:', error);
    throw error;
  }
};

/**
 * Default call script template
 */
export const defaultCallScript = {
  greeting: "Hello, this is {{firstName}} from {{company}}.",
  introduction: "I'm calling today to discuss how our solution can help businesses like {{company}} improve their sales processes and customer relationships.",
  talking_points: [
    "Our platform helps businesses increase revenue by 30% on average.",
    "We've worked with several companies in the {{industry}} industry with great success.",
    "Our solution can integrate with your existing tools to provide a seamless experience.",
    "Companies like yours have seen significant improvements in customer retention."
  ],
  questions: [
    "Is now a good time to talk about how we could help {{company}}?",
    "What challenges is {{company}} currently facing with your sales process?",
    "How is your team currently handling customer relationships?",
    "What tools are you using now for your CRM needs?"
  ],
  closing: "Thank you for your time, {{name}}. I'd be happy to schedule a follow-up meeting to discuss this further and show you a demo of our platform.",
  ai_model: "gpt-4",
  voice: "shimmer" // Using VAPI's voice
}; 