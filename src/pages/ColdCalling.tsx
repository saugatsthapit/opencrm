import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, History, Settings, ExternalLink } from 'lucide-react';
import CallScriptEditor from '../components/CallScriptEditor';
import CallHistory from '../components/CallHistory';
import { defaultCallScript, placeCall, setNgrokUrl, clearNgrokSettings } from '../lib/vapi';
import { supabase } from '../lib/supabase';

export default function ColdCalling() {
  const [activeTab, setActiveTab] = useState('calls');
  const [callScript, setCallScript] = useState(defaultCallScript);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualNgrokUrl, setManualNgrokUrl] = useState('');

  const isProduction = window.location.hostname === 'fastcrm.netlify.app';
  const hasNgrokConfigured = isProduction && localStorage.getItem('ngrok_url');

  useEffect(() => {
    // Fetch leads when component mounts
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, company_name, phone')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCall = async (phoneNumber: string) => {
    if (!selectedLead) {
      setError('Please select a lead first');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCallResult(null);

      const response = await placeCall(
        phoneNumber,
        selectedLead,
        callScript
      );

      setCallResult(response);
      // Refresh call history after making a call
      setActiveTab('history');
    } catch (err: any) {
      console.error('Error making call:', err);
      
      // Handle network connection errors specifically
      if (err.message.includes('Failed to fetch')) {
        setError('Network connection error: Unable to reach the API server. Make sure the server is running at http://localhost:8002 and the Vite proxy is configured correctly.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetNgrokUrl = () => {
    if (manualNgrokUrl) {
      setNgrokUrl(manualNgrokUrl);
      window.location.reload();
    }
  };

  const handleClearNgrokSettings = () => {
    clearNgrokSettings();
    setManualNgrokUrl('');
    window.location.reload();
  };

  const getLeadName = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return 'Unknown Lead';
    return `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || 'Unknown';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Cold Calling</h1>
      
      {isProduction && !hasNgrokConfigured && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4" role="alert">
          <h3 className="font-bold">Production Environment Detected</h3>
          <p className="mb-2">The cold calling feature requires a running API server which is not yet deployed to production.</p>
          
          <div className="mb-4">
            <h4 className="font-semibold">Option 1: Run locally</h4>
            <p className="mb-2">To test cold calling locally:</p>
            <ol className="list-decimal list-inside mb-2">
              <li>Clone the repository to your local machine</li>
              <li>Run the local development server: <code className="bg-gray-200 px-1">npm run dev</code></li>
              <li>Access the app at <code className="bg-gray-200 px-1">http://localhost:5173</code></li>
            </ol>
          </div>
          
          <div className="mb-4">
            <h4 className="font-semibold">Option 2: Use ngrok with the production frontend</h4>
            <p className="mb-2">To test from this production site:</p>
            <ol className="list-decimal list-inside mb-2">
              <li>Run your API server locally: <code className="bg-gray-200 px-1">npm run server</code></li>
              <li>Set up ngrok following the instructions in the README</li>
              <li>Enter your ngrok URL below:</li>
            </ol>
            
            <div className="flex items-center mt-2">
              <input 
                type="text" 
                placeholder="https://your-ngrok-url.ngrok.io" 
                className="border rounded px-2 py-1 mr-2 flex-grow"
                value={manualNgrokUrl}
                onChange={(e) => setManualNgrokUrl(e.target.value)}
              />
              <button 
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                onClick={handleSetNgrokUrl}
              >
                Connect
              </button>
            </div>
          </div>
          
          <p>Calls attempted without proper configuration will fail with errors.</p>
        </div>
      )}
      
      {isProduction && hasNgrokConfigured && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" role="alert">
          <h3 className="font-bold">ngrok Connection Configured</h3>
          <p className="mb-2">
            Connected to API server via ngrok: <code className="bg-gray-200 px-1">{localStorage.getItem('ngrok_url')}</code>
          </p>
          <p className="mb-2">
            Make sure your local server is running and accessible through this ngrok URL.
          </p>
          <button 
            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
            onClick={handleClearNgrokSettings}
          >
            Remove ngrok Configuration
          </button>
        </div>
      )}
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1 bg-white rounded-lg shadow p-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Leads</h2>
          {/* ... rest of the component */}
        </div>
      </div>
    </div>
  );
} 