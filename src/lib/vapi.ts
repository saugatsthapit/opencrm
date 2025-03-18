import { supabase } from './supabase';

// Determine the API base URL based on the current environment
const getApiBaseUrl = () => {
  // If we're on the production site (fastcrm.netlify.app)
  if (window.location.hostname === 'fastcrm.netlify.app') {
    // Check if the user has configured a local server with ngrok in localStorage
    const storedNgrokUrl = localStorage.getItem('ngrok_url');
    
    if (storedNgrokUrl) {
      console.log(`Using configured ngrok URL: ${storedNgrokUrl}`);
      return `${storedNgrokUrl}/api/v1/calls`;
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
  leadSequenceId?: string,
  stepId?: string
) => {
  try {
    // Check if we're on production without a properly configured ngrok
    if (window.location.hostname === 'fastcrm.netlify.app' && !localStorage.getItem('ngrok_url')) {
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

    // Make API request to our new endpoint
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        lead,
        script,
        lead_sequence_id: leadSequenceId,
        step_id: stepId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to place call');
    }

    return await response.json();
  } catch (error) {
    console.error('Error placing call:', error);
    throw error;
  }
};

// For backward compatibility
export const placeCallLegacy = async (
  phoneNumber: string,
  leadId: string,
  script: any,
  leadSequenceId?: string,
  stepId?: string
) => {
  try {
    const response = await fetch(`${API_BASE_URL}/place`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        lead_id: leadId,
        script,
        lead_sequence_id: leadSequenceId,
        step_id: stepId
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to place call');
    }

    return await response.json();
  } catch (error) {
    console.error('Error placing call:', error);
    throw error;
  }
};

/**
 * Get the status of a specific call
 */
export const getCallStatus = async (callId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/status/${callId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get call status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting call status:', error);
    throw error;
  }
};

/**
 * Get call history for a specific lead
 */
export const getCallHistory = async (leadId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${leadId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get call history');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting call history:', error);
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
 * Default call script template
 */
export const defaultCallScript = {
  greeting: "Hello, this is {{firstName}} from {{company}}.",
  introduction: "I'm calling today about our solution that helps businesses like {{company}} improve their sales automation.",
  talking_points: [
    "Our platform helps businesses increase revenue by 30% on average.",
    "We specialize in helping companies in the {{industry}} industry.",
    "Our solution integrates with your existing tools and workflows."
  ],
  questions: [
    "Is now a good time to talk about how we could help your business?",
    "What challenges are you currently facing with your sales process?",
    "Would you be interested in learning more about our solution?"
  ],
  closing: "Thank you for your time today. I'd be happy to schedule a follow-up call to discuss this further.",
  ai_model: "gpt-4",
  voice: "shimmer" // Using VAPI's voice
}; 