import React, { useState } from 'react';
import { testApiConnection, testCorsConnection, testCallAPICors, debugCallAPI } from '../lib/api';
import { getApiBaseUrl } from '../config/env';

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

const CorsTest = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeCallApiTests, setIncludeCallApiTests] = useState(false);

  const runTests = async () => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      // Get API base URL for display
      const apiBaseUrl = getApiBaseUrl();
      
      // Test 1: Health Check
      const healthResult = await testApiConnection();
      setResults(prev => [...prev, {
        success: healthResult.success,
        message: healthResult.success 
          ? 'Health check successful' 
          : `Health check failed: ${healthResult.error}`,
        details: healthResult.data
      }]);

      // Test 2: CORS Test
      const corsResult = await testCorsConnection();
      setResults(prev => [...prev, {
        success: corsResult.success,
        message: corsResult.success 
          ? 'CORS test successful' 
          : `CORS test failed: ${corsResult.error}`,
        details: corsResult.data
      }]);

      // Call API specific tests
      if (includeCallApiTests) {
        // Test 3: Call API CORS Check
        try {
          const callCorsResult = await testCallAPICors();
          setResults(prev => [...prev, {
            success: callCorsResult.success,
            message: callCorsResult.success 
              ? 'Call API CORS test successful' 
              : `Call API CORS test failed: ${callCorsResult.error}`,
            details: callCorsResult.data
          }]);
        } catch (callCorsError: any) {
          setResults(prev => [...prev, {
            success: false,
            message: `Call API CORS test failed with exception: ${callCorsError.message}`,
            details: null
          }]);
        }

        // Test 4: Call API Debug Endpoint
        try {
          const debugResult = await debugCallAPI();
          setResults(prev => [...prev, {
            success: debugResult.success,
            message: debugResult.success 
              ? 'Call API debug test successful' 
              : `Call API debug test failed: ${debugResult.error}`,
            details: debugResult.data
          }]);
        } catch (debugError: any) {
          setResults(prev => [...prev, {
            success: false,
            message: `Call API debug test failed with exception: ${debugError.message}`,
            details: null
          }]);
        }
      }

    } catch (err: any) {
      setError(`Error running tests: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">Current API URL: <code className="bg-gray-100 px-2 py-1 rounded">{getApiBaseUrl()}</code></p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeCallApiTests}
              onChange={(e) => setIncludeCallApiTests(e.target.checked)}
              className="mr-2 rounded text-blue-600 focus:ring-blue-500"
            />
            Include Call API Tests
          </label>
          <button
            onClick={runTests}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Testing...' : 'Test API Connection'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="font-medium">Test Results</h3>
          </div>
          <div className="divide-y">
            {results.map((result, index) => (
              <div key={index} className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-medium">{result.message}</span>
                </div>
                {result.details && (
                  <div className="mt-2 text-sm bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    <pre>{JSON.stringify(result.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && results.length > 0 && !results.every(r => r.success) && (
        <div className="text-sm text-gray-700 bg-yellow-50 p-4 rounded-lg">
          <p className="font-semibold mb-1">Troubleshooting Tips:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Check if your server is running (on port 8002)</li>
            <li>Verify ngrok is running and tunneling to the correct port</li>
            <li>Ensure CORS is properly configured on your server</li>
            <li>Check browser console for detailed error messages</li>
            <li>Try restarting both the client and server</li>
            <li>For call API issues, make sure the call route handlers have proper CORS settings</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default CorsTest; 