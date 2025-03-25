import { getApiBaseUrl } from '../config/env';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const testApiConnection = async (): Promise<ApiResponse<any>> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const healthUrl = apiBaseUrl.startsWith('http') 
      ? `${apiBaseUrl.replace(/\/api\/v1$/, '/api/health')}`
      : `/api/health`;
    
    console.log(`[API] Testing connection to: ${healthUrl}`);
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('[API] Health check failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to API server',
    };
  }
};

export const testCorsConnection = async (): Promise<ApiResponse<any>> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const corsTestUrl = apiBaseUrl.startsWith('http') 
      ? `${apiBaseUrl.replace(/\/api\/v1$/, '/api/cors-test')}`
      : `/api/cors-test`;
    
    console.log(`[API] Testing CORS connection to: ${corsTestUrl}`);
    const response = await fetch(corsTestUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`CORS test failed with status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('[API] CORS test failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to API server',
    };
  }
};

export const testCallAPICors = async (): Promise<ApiResponse<any>> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const callCorsUrl = apiBaseUrl.startsWith('http') 
      ? `${apiBaseUrl.replace(/\/api\/v1$/, '/api/v1/calls/cors-check')}`
      : `/api/v1/calls/cors-check`;
    
    console.log(`[API] Testing call API CORS connection to: ${callCorsUrl}`);
    const response = await fetch(callCorsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Call API CORS test failed with status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('[API] Call API CORS test failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to Call API server',
    };
  }
};

export const debugCallAPI = async (): Promise<ApiResponse<any>> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const debugUrl = apiBaseUrl.startsWith('http') 
      ? `${apiBaseUrl.replace(/\/api\/v1$/, '/api/v1/calls/debug')}`
      : `/api/v1/calls/debug`;
    
    console.log(`[API] Testing call API debug endpoint: ${debugUrl}`);
    const response = await fetch(debugUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString()
      }),
      mode: 'cors',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Call API debug test failed with status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error('[API] Call API debug test failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to Call API debug endpoint',
    };
  }
}; 