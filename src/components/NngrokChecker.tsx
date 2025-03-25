import React, { useEffect, useState } from 'react';
import { getNgrokUrl, setNgrokUrl, getApiBaseUrl, setApiUrl } from '../config/env';

interface NgrokCheckerProps {
  children: React.ReactNode;
}

export default function NgrokChecker({ children }: NgrokCheckerProps) {
  const [ngrokUrl, setNgrokUrlState] = useState('');
  const [apiUrl, setApiUrlState] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [manualNgrokInput, setManualNgrokInput] = useState('');
  const [manualApiInput, setManualApiInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [useDirectApiUrl, setUseDirectApiUrl] = useState(false);

  useEffect(() => {
    // Check for ngrok URL and API URL
    const detectedNgrokUrl = getNgrokUrl();
    const detectedApiUrl = getApiBaseUrl();
    
    console.log('NgrokChecker - Detected URLs:', {
      ngrokUrl: detectedNgrokUrl,
      apiUrl: detectedApiUrl
    });
    
    setNgrokUrlState(detectedNgrokUrl);
    setApiUrlState(detectedApiUrl);
    
    // If neither URL is found, show the prompt
    if (!detectedNgrokUrl && !detectedApiUrl.startsWith('http')) {
      setShowPrompt(true);
    }
    
    setIsLoading(false);
  }, []);
  
  // Update API input based on ngrok input
  useEffect(() => {
    if (!useDirectApiUrl && manualNgrokInput) {
      setManualApiInput(`${manualNgrokInput}/api/v1`);
    }
  }, [manualNgrokInput, useDirectApiUrl]);
  
  const handleSetUrls = () => {
    if (useDirectApiUrl && manualApiInput) {
      // Set only the API URL
      setApiUrl(manualApiInput);
      console.log('Setting API URL to:', manualApiInput);
    } else if (manualNgrokInput) {
      // Set the ngrok URL (which also sets API URL)
      setNgrokUrl(manualNgrokInput);
      console.log('Setting ngrok URL to:', manualNgrokInput);
    }
    
    // Reload to apply changes
    window.location.reload();
  };
  
  if (isLoading) {
    return <div className="p-4">Loading application configuration...</div>;
  }
  
  if (showPrompt) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-semibold mb-4">API Configuration Required</h2>
          <p className="mb-4">
            This application requires a valid API URL to function properly.
          </p>
          
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="useDirectApiUrl"
                checked={useDirectApiUrl}
                onChange={(e) => setUseDirectApiUrl(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="useDirectApiUrl">
                Use direct API URL (advanced)
              </label>
            </div>
            
            {!useDirectApiUrl ? (
              <>
                <label className="block text-sm font-medium mb-1">
                  ngrok URL from .env file (NGROK_URL):
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded mb-2"
                  value={manualNgrokInput}
                  onChange={(e) => setManualNgrokInput(e.target.value)}
                  placeholder="https://your-ngrok-url.ngrok.io"
                />
                <div className="text-sm text-gray-500 mb-4">
                  API URL will be: {manualNgrokInput ? `${manualNgrokInput}/api/v1` : ''}
                </div>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium mb-1">
                  Direct API URL from .env file (VITE_API_URL):
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={manualApiInput}
                  onChange={(e) => setManualApiInput(e.target.value)}
                  placeholder="https://your-ngrok-url.ngrok.io/api/v1"
                />
              </>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              className="px-4 py-2 bg-red-500 text-white rounded"
              onClick={() => setShowPrompt(false)}
            >
              Skip (Not Recommended)
            </button>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={handleSetUrls}
              disabled={useDirectApiUrl ? !manualApiInput : !manualNgrokInput}
            >
              Set URL Configuration
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
} 