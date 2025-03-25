import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Sequences from './pages/Sequences';
import ColdCalling from './pages/ColdCalling';
import Settings from './pages/Settings';
import AddLead from './pages/AddLead';
import NgrokChecker from './components/NgrokChecker';
import { getApiBaseUrl } from './config/env';

function App() {
  useEffect(() => {
    // Intercept all fetch requests to redirect API calls to the correct URL
    const originalFetch = window.fetch;
    
    window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      const url = input.toString();
      
      // Only intercept API calls that start with /api
      if (url.startsWith('/api')) {
        const apiBaseUrl = getApiBaseUrl();
        // Only redirect if apiBaseUrl is a full URL (not just a path)
        if (apiBaseUrl.startsWith('http')) {
          // Replace /api with the full API URL
          const newUrl = url.replace(/^\/api/, apiBaseUrl.replace(/\/api\/v1$/, '/api'));
          console.log(`[App] Redirecting fetch from ${url} to ${newUrl}`);
          
          // Create a new init object with CORS configuration
          const newInit: RequestInit = {
            ...init,
            mode: 'cors',
            credentials: 'include',
            headers: {
              ...init?.headers,
              'Content-Type': 'application/json',
            }
          };
          
          // Use the original fetch with the new URL and configuration
          return originalFetch(newUrl, newInit)
            .then(response => {
              if (!response.ok) {
                console.error(`[App] Request failed with status: ${response.status}`);
              }
              return response;
            })
            .catch(error => {
              console.error(`[App] Fetch error:`, error);
              
              // For CORS errors, show a more helpful message
              if (error.message && error.message.includes('CORS')) {
                console.error(`[App] CORS error detected. Make sure your server is configured to allow requests from ${window.location.origin}`);
                alert(`CORS error: Unable to connect to the API server. Please check console for details.`);
              }
              
              throw error;
            });
        }
      }
      
      // For all other requests, use the original fetch
      return originalFetch(input, init);
    };
    
    // Debug environment variables
    console.log('All Environment Variables:');
    console.log('VITE_NGROK_URL:', import.meta.env.VITE_NGROK_URL);
    console.log('NGROK_URL:', import.meta.env.NGROK_URL);
    console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
    console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    
    // Log the result of our utility function
    console.log('getApiBaseUrl():', getApiBaseUrl());
    
    return () => {
      // Restore the original fetch when the component unmounts
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <NgrokChecker>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sequences" element={<Sequences />} />
                <Route path="/cold-calling" element={<ColdCalling />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/add-lead" element={<AddLead />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </NgrokChecker>
  );
}

export default App;