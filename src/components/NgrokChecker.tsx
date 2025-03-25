import React, { useState, useEffect } from 'react';
import { getApiBaseUrl, getNgrokUrl } from '../config/env';

interface NgrokCheckerProps {
  children: React.ReactNode;
}

const NgrokChecker: React.FC<NgrokCheckerProps> = ({ children }) => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConfiguration = () => {
      try {
        const ngrokUrl = getNgrokUrl();
        const apiBaseUrl = getApiBaseUrl();
        
        // Check if we have a valid ngrok URL
        if (!ngrokUrl || ngrokUrl === 'undefined' || ngrokUrl === '') {
          setError('Ngrok URL is not configured. Please start ngrok and set the VITE_NGROK_URL environment variable.');
          setIsConfigured(false);
          return;
        }
        
        // Check if it's a valid URL
        try {
          new URL(ngrokUrl);
        } catch (e) {
          setError(`Invalid Ngrok URL: ${ngrokUrl}. Please check your configuration.`);
          setIsConfigured(false);
          return;
        }
        
        // Everything is fine
        setIsConfigured(true);
        setError(null);
        
        console.log('[NgrokChecker] Configuration valid:');
        console.log('- Ngrok URL:', ngrokUrl);
        console.log('- API Base URL:', apiBaseUrl);
      } catch (err: any) {
        setError(`Error checking configuration: ${err.message}`);
        setIsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkConfiguration();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking configuration...</p>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-red-600 text-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold mt-2">Configuration Error</h2>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700">{error}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded text-sm">
            <h3 className="font-medium mb-2">How to fix:</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Start ngrok with: <code className="bg-gray-200 px-1 rounded">ngrok http 8002</code></li>
              <li>Copy the ngrok URL (e.g., <code className="bg-gray-200 px-1 rounded">https://abcd1234.ngrok.io</code>)</li>
              <li>Add to <code className="bg-gray-200 px-1 rounded">.env.local</code> file: <code className="bg-gray-200 px-1 rounded">VITE_NGROK_URL=your_ngrok_url</code></li>
              <li>Restart the development server</li>
            </ol>
          </div>
          
          <div className="mt-6">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default NgrokChecker; 