/**
 * Centralized access to environment variables
 * This ensures consistent access across the application
 */

// Check if we are in the client (browser) or server environment
const isClient = typeof window !== 'undefined';

// Hard-coded ngrok URL from .env (retrieved at build time for development)
// UPDATE THIS LINE MANUALLY AFTER CHECKING THE .ENV FILE
const HARD_CODED_NGROK_URL = "https://7a3c-2601-483-4400-1210-5c4e-1649-f98-7a97.ngrok-free.app";
const HARD_CODED_API_URL = "https://74eb-2601-483-4400-1210-eca7-99fa-2942-de42.ngrok-free.app/api/v1";

// Get ngrok URL with proper priority:
// 1. localStorage (user override)
// 2. Hard-coded value from .env file
// 3. Environment variables from Vite
// 4. Default to empty string
export const getNgrokUrl = (): string => {
  if (isClient) {
    // Client-side environment
    const fromLocalStorage = localStorage.getItem('ngrok_url');
    // Try to access environment variables defined by Vite
    const fromViteEnv = import.meta.env?.VITE_NGROK_URL || import.meta.env?.NGROK_URL;
    // Use global variable defined in vite.config.ts
    const fromGlobal = (window as any).__NGROK_URL__;
    
    // Log all sources for debugging
    console.log('[env.ts] NGROK sources:', {
      localStorage: fromLocalStorage,
      hardCoded: HARD_CODED_NGROK_URL,
      viteEnv: fromViteEnv,
      global: fromGlobal
    });
    
    return fromLocalStorage || HARD_CODED_NGROK_URL || fromViteEnv || fromGlobal || '';
  } else {
    // Server-side environment (should never be executed in browser)
    return process.env.NGROK_URL || '';
  }
};

// Get API base URL based on ngrok configuration
export const getApiBaseUrl = (): string => {
  // First check for direct API URL from environment or localStorage
  const apiUrlFromLocalStorage = localStorage.getItem('api_url');
  const apiUrlFromEnv = import.meta.env?.VITE_API_URL;
  const apiUrlFromGlobal = (window as any).__API_URL__;
  
  // Log for debugging
  console.log('[env.ts] Direct API URL sources:', {
    localStorage: apiUrlFromLocalStorage,
    hardCoded: HARD_CODED_API_URL,
    envVar: apiUrlFromEnv,
    global: apiUrlFromGlobal
  });
  
  // Use direct API URL if available
  if (apiUrlFromLocalStorage) {
    console.log('[env.ts] Using API URL from localStorage:', apiUrlFromLocalStorage);
    return apiUrlFromLocalStorage;
  }
  
  if (apiUrlFromEnv) {
    console.log('[env.ts] Using API URL from environment:', apiUrlFromEnv);
    return apiUrlFromEnv;
  }
  
  if (apiUrlFromGlobal) {
    console.log('[env.ts] Using API URL from global variable:', apiUrlFromGlobal);
    return apiUrlFromGlobal;
  }
  
  if (HARD_CODED_API_URL) {
    console.log('[env.ts] Using hard-coded API URL:', HARD_CODED_API_URL);
    return HARD_CODED_API_URL;
  }
  
  // Fallback to constructing from ngrok URL
  const ngrokUrl = getNgrokUrl();
  if (ngrokUrl) {
    const baseUrl = `${ngrokUrl}/api/v1`;
    console.log('[env.ts] Using API URL constructed from ngrokUrl:', baseUrl);
    return baseUrl;
  }
  
  // Default fallback
  console.log('[env.ts] Using default relative API path');
  return '/api/v1';
};

// Set API URL in localStorage
export const setApiUrl = (url: string): void => {
  localStorage.setItem('api_url', url);
  console.log(`Set API URL to ${url}`);
};

// Set ngrok URL in localStorage
export const setNgrokUrl = (url: string): void => {
  localStorage.setItem('ngrok_url', url);
  console.log(`Set ngrok URL to ${url}`);
  
  // Also set the API URL based on this ngrok URL
  const apiUrl = `${url}/api/v1`;
  setApiUrl(apiUrl);
};

// Clear ngrok URL from localStorage
export const clearNgrokUrl = (): void => {
  localStorage.removeItem('ngrok_url');
  localStorage.removeItem('api_url');
  localStorage.removeItem('ngrok_prompt_shown');
  console.log('Cleared ngrok URL settings');
}; 