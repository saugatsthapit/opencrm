// Simple test script for VAPI configuration
const { VapiClient } = require('@vapi-ai/server-sdk');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables
dotenv.config();

// Log key environment variables (redacted for security)
console.log('VAPI Configuration Test');
console.log('======================');
console.log('Public Key (starts with):', process.env.VITE_VAPI_API_KEY.substring(0, 8) + '...');
console.log('Private Key (starts with):', process.env.VITE_VAPI_PRIVATE_KEY.substring(0, 8) + '...');
console.log('Assistant ID:', process.env.VITE_VAPI_ASSISTANT_ID);
console.log('Phone Number ID:', process.env.VITE_VAPI_PHONE_NUMBER_ID);
console.log('Webhook URL:', process.env.NGROK_URL ? `${process.env.NGROK_URL}/api/v1/calls/vapi-webhook` : 'Not set');
console.log('======================');

// Initialize VAPI client with the private key
const vapiClient = new VapiClient({ 
  apiKey: process.env.VITE_VAPI_PRIVATE_KEY.trim()
});

// Phone number to test (change this to your test phone number)
const TEST_PHONE_NUMBER = "+17033974597"; // Replace with your test number

async function testVapiCall() {
  try {
    console.log(`Testing VAPI call to ${TEST_PHONE_NUMBER}...`);
    
    // Get webhook URL for VAPI events
    const webhookUrl = process.env.NGROK_URL 
      ? `${process.env.NGROK_URL}/api/v1/calls/vapi-webhook` 
      : null;
    
    // Check if it's a valid HTTPS or WSS URL
    const isValidWebhookUrl = webhookUrl && (webhookUrl.startsWith('https://') || webhookUrl.startsWith('wss://'));
    console.log(`Is webhook URL valid: ${isValidWebhookUrl}`);
    
    // Create a simple payload for the test call
    const callPayload = {
      name: "VAPI Test Call",
      phoneNumberId: process.env.VITE_VAPI_PHONE_NUMBER_ID,
      assistantId: process.env.VITE_VAPI_ASSISTANT_ID,
      customer: {
        number: TEST_PHONE_NUMBER,
        name: "Test User"
      },
      metadata: {
        test: true,
        timestamp: Date.now()
      },
      assistantOverrides: {
        firstMessage: "Hello, this is a test call to verify our VAPI configuration. This call will end in a few seconds.",
        
        // Only add server webhook if URL is valid
        ...(isValidWebhookUrl ? {
          serverMessages: ["status-update", "end-of-call-report"],
          server: {
            url: webhookUrl,
            timeoutSeconds: 30
          }
        } : {})
      }
    };
    
    console.log('Call payload:', JSON.stringify(callPayload, null, 2));
    
    try {
      // Try with SDK first
      console.log('Attempting call with VAPI SDK...');
      const result = await vapiClient.calls.create(callPayload);
      console.log('SUCCESS: VAPI SDK call created:', result);
      return result;
    } catch (sdkError) {
      console.error('ERROR: VAPI SDK call failed:', sdkError);
      
      // Try with direct API call as fallback
      console.log('Falling back to direct API call...');
      try {
        const response = await fetch('https://api.vapi.ai/call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VITE_VAPI_PRIVATE_KEY}`,
          },
          body: JSON.stringify(callPayload)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
          console.error('ERROR: Direct API call failed:', responseData);
          return { success: false, error: responseData };
        }
        
        console.log('SUCCESS: Direct API call succeeded:', responseData);
        return responseData;
      } catch (directError) {
        console.error('ERROR: Direct API call exception:', directError);
        return { success: false, sdkError, directError };
      }
    }
  } catch (error) {
    console.error('ERROR: Test failed with exception:', error);
    return { success: false, error };
  }
}

// Run the test
testVapiCall()
  .then(result => {
    console.log('Test completed with result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed with error:', error);
    process.exit(1);
  }); 