import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, History, Settings, List, CheckCircle, Users } from 'lucide-react';
import CallScriptEditor from '../components/CallScriptEditor';
import CallHistory from '../components/CallHistory';
import { defaultCallScript, placeCall, setNgrokUrl as setVapiNgrokUrl, clearNgrokSettings } from '../lib/vapi';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';
import { getNgrokUrl, getApiBaseUrl, setNgrokUrl as setEnvNgrokUrl } from '../config/env';

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  mobile_phone1: string | null;
  mobile_phone2: string | null;
  title: string | null;
  called?: boolean;
  call_status?: {
    has_been_called: boolean;
    last_call?: {
      id: string;
      status: string;
      timestamp: string;
      recording_url?: string;
      error_message?: string;
      transcript?: string;
      summary?: string;
      ended_reason?: string;
      notes?: string;
      interest_status?: 'green' | 'yellow' | 'red' | null;
      success: boolean;
    };
  };
}

export default function ColdCalling() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('calls');
  const [callScript, setCallScript] = useState(defaultCallScript);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualNgrokUrl, setManualNgrokUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('f76e2b49-9b62-463f-88eb-1085c16f47c6');
  
  // Add console logging for assistant selection
  useEffect(() => {
    console.log('[ColdCalling] Selected Assistant ID:', selectedAssistantId);
  }, [selectedAssistantId]);

  // Use our new utility function to get the ngrokUrl
  const [ngrokUrl, setNgrokUrlState] = useState(getNgrokUrl);

  const isProduction = window.location.hostname === 'fastcrm.netlify.app';
  const hasNgrokConfigured = isProduction && localStorage.getItem('ngrok_url');

  // Create an array of assistants
  const assistants = [
    { id: 'bdae6e5a-931b-477b-b9f2-421a776adb0d', name: 'Male Voice' },
    { id: 'f76e2b49-9b62-463f-88eb-1085c16f47c6', name: 'Female Voice' }
  ];

  useEffect(() => {
    // Fetch leads when component mounts
    fetchLeads();
  }, []);
  
  // Handle pre-selected lead from navigation
  useEffect(() => {
    if (location.state) {
      if (location.state.selectedLeadId) {
        // If a single lead was selected in the Dashboard and passed via navigation
        handleLeadSelection(location.state.selectedLeadId);
        
        // Set the active tab to 'calls'
        setActiveTab('calls');
      } else if (location.state.selectedLeads && location.state.selectedLeads.length > 0) {
        // If multiple leads were selected for batch calling
        // setSelectedLeads(location.state.selectedLeads);
        
        // Set the active tab to 'batch'
        // setActiveTab('batch');
      }
    }
  }, [location.state, leads]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('id, first_name, last_name, email, company_name, mobile_phone1, mobile_phone2, title')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Add called property to each lead for batch calling
      const updatedData = (data || []).map(lead => ({
        ...lead,
        called: false
      }));
      
      setLeads(updatedData);
      
      // If a lead is already selected, update its phone number
      if (selectedLead) {
        const selectedLeadData = updatedData.find(l => l.id === selectedLead);
        if (selectedLeadData && selectedLeadData.mobile_phone1) {
          setPhoneNumber(selectedLeadData.mobile_phone1);
        }
      }
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Format a phone number to E.164 format (+country code and only digits)
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');
    
    // If the number already starts with a +, just return it with non-digits removed
    if (phone.startsWith('+')) {
      return '+' + digitsOnly;
    }
    
    // If it starts with a 1 (US), add + prefix
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
      return '+' + digitsOnly;
    }
    
    // If it's a 10-digit number (assuming US), add +1 prefix
    if (digitsOnly.length === 10) {
      return '+1' + digitsOnly;
    }
    
    // For any other format, just add + prefix
    return '+' + digitsOnly;
  };

  const handleTestCall = async () => {
    if (!selectedLead) {
      setError('No lead selected');
      return;
    }
    
    if (!selectedAssistantId) {
      setError('Please select an assistant first.');
      return;
    }
    
    // Find the selected lead to get its call status and interest level
    const lead = leads.find(l => l.id === selectedLead);
    
    // Prevent calling leads with Green or Red interest status
    if (lead?.call_status?.last_call?.interest_status === 'green' || 
        lead?.call_status?.last_call?.interest_status === 'red') {
      const statusText = lead.call_status.last_call.interest_status === 'green' ? 'interested' : 'not interested';
      setError(`This lead has already been marked as ${statusText}. Are you sure you want to call again?`);
      
      // Show a confirmation dialog
      if (!window.confirm(`This lead is marked as ${statusText}. Call anyway?`)) {
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Format the phone number before making the call
      const formattedNumber = formatPhoneNumber(phoneNumber);
      
      console.log(`[ColdCalling] Initiating call to ${formattedNumber} for lead ${selectedLead}`);
      console.log(`[ColdCalling] Using ngrok URL: ${ngrokUrl || 'none provided'}`);
      console.log('Making call with assistantIDDD:', selectedAssistantId);

      // Try the updated placeCall function with better CORS handling
      const response = await placeCall(
        formattedNumber,
        selectedLead,
        callScript,
        ngrokUrl,
        undefined,
        undefined,
        selectedAssistantId
      );

      console.log(`[ColdCalling] Call initiated successfully:`, response);
      setCallResult(response);
      
      // Use utility function to get API base URL
      const apiBaseUrl = getApiBaseUrl();
      
      console.log(`[ColdCalling] Marking lead as called using API: ${apiBaseUrl}`);
      
      // Mark this lead as called using our new endpoint
      try {
        const markResponse = await fetch(`${apiBaseUrl}/calls/lead/${selectedLead}/mark-called`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            callDetails: {
              timestamp: new Date().toISOString(),
              notes: `Call placed to ${formattedNumber}`,
              success: true
            }
          }),
          credentials: 'include',
          mode: 'cors'
        });
        
        if (!markResponse.ok) {
          console.warn(`[ColdCalling] Failed to mark lead as called: ${markResponse.status}`);
        } else {
          console.log(`[ColdCalling] Lead marked as called successfully`);
        }
      } catch (markError) {
        console.error(`[ColdCalling] Error marking lead as called:`, markError);
      }
      
      // Mark this lead as called in the UI
      setLeads(prevLeads => 
        prevLeads.map(l => 
          l.id === selectedLead ? { ...l, called: true } : l
        )
      );
      
      // Refresh call history after making a call
      setActiveTab('history');
    } catch (err: any) {
      console.error('[ColdCalling] Error making call:', err);
      
      // Handle network connection errors specifically
      if (err.message && err.message.includes('Failed to fetch')) {
        setError(`Network connection error: Unable to reach the API server. Make sure the server is running and CORS is properly configured. Details: ${err.message}`);
      } else if (err.message && err.message.includes('CORS')) {
        setError(`CORS error: The server is blocking cross-origin requests. This could be due to misconfigured CORS settings. Try restarting the server or using a different URL. Details: ${err.message}`);
      } else {
        setError(err.message);
      }
      
      // Mark the call as failed in our tracking
      try {
        // Use utility function to get API base URL
        const apiBaseUrl = getApiBaseUrl();
        const markFailedResponse = await fetch(`${apiBaseUrl}/calls/lead/${selectedLead}/mark-called`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            callDetails: {
              timestamp: new Date().toISOString(),
              notes: `Failed to place call: ${err.message}`,
              success: false,
              error_message: err.message
            }
          }),
          credentials: 'include',
          mode: 'cors'
        });
        
        if (!markFailedResponse.ok) {
          console.warn(`[ColdCalling] Failed to mark failed call: ${markFailedResponse.status}`);
        }
      } catch (markErr) {
        console.error('[ColdCalling] Error marking lead call as failed:', markErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetNgrokUrl = () => {
    if (manualNgrokUrl) {
      setVapiNgrokUrl(manualNgrokUrl);
      setEnvNgrokUrl(manualNgrokUrl);
      setNgrokUrlState(manualNgrokUrl);
      window.location.reload();
    }
  };

  const handleClearNgrokSettings = () => {
    clearNgrokSettings();
    setManualNgrokUrl('');
    setNgrokUrlState('');
    window.location.reload();
  };

  const getLeadName = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return 'Unknown Lead';
    return `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || 'Unknown';
  };
  
  // Update phone number when selecting a lead
  const handleLeadSelection = (leadId: string) => {
    setSelectedLead(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead && lead.mobile_phone1) {
      setPhoneNumber(lead.mobile_phone1);
    } else {
      setPhoneNumber(''); // Clear phone if lead has no phone
    }
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
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leads List */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Leads</h2>
          
          {loading && leads.length === 0 ? (
            <p className="text-gray-500">Loading leads...</p>
          ) : leads.length === 0 ? (
            <p className="text-gray-500">No leads found. Please add some leads first.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <li 
                    key={lead.id} 
                    className={`py-2 px-2 cursor-pointer hover:bg-gray-50 ${
                      selectedLead === lead.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      handleLeadSelection(lead.id);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{lead.first_name} {lead.last_name}</div>
                        <div className="text-sm text-gray-500">{lead.company_name}</div>
                        {lead.mobile_phone1 ? (
                          <div className="text-sm text-gray-500">{lead.mobile_phone1}</div>
                        ) : (
                          <div className="text-sm text-red-500 italic">No phone number</div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        
        {/* Tabs and Content */}
        <div className="col-span-2 bg-white rounded-lg shadow">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <button
              className={`px-4 py-2 flex items-center ${activeTab === 'calls' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab('calls')}
            >
              <Phone size={18} className="mr-2" />
              Single Call
            </button>
            <button
              className={`px-4 py-2 flex items-center ${activeTab === 'script' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab('script')}
            >
              <Settings size={18} className="mr-2" />
              Call Script
            </button>
            <button
              className={`px-4 py-2 flex items-center ${activeTab === 'history' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={18} className="mr-2" />
              Call History
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'calls' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Place a Call</h3>
                
                <div className="mb-4">
                  <p className="font-semibold mb-2">Select an Assistant</p>
                  <div className="flex space-x-4">
                    {assistants.map((assistant) => (
                      <button
                        key={assistant.id}
                        className={`px-3 py-2 rounded border ${
                          selectedAssistantId === assistant.id ? 'bg-blue-100 border-blue-400' : 'border-gray-300'
                        }`}
                        onClick={() => {
                          console.log('[ColdCalling] Selecting assistant:', assistant.name, assistant.id);
                          setSelectedAssistantId(assistant.id);
                        }}
                      >
                        {assistant.name}
                      </button>
                    ))}
                  </div>
                  {!selectedAssistantId && <p className="text-sm text-red-500 mt-1">No assistant selected</p>}
                </div>
                
                {selectedLead ? (
                  <div>
                    <p className="mb-2">
                      Selected Lead: <span className="font-medium">{getLeadName(selectedLead)}</span>
                    </p>
                    
                    <div className="mb-4">
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number
                      </label>
                      {(() => {
                        const lead = leads.find(l => l.id === selectedLead);
                        if (!lead) return null;
                        
                        return (
                          <div className="space-y-2">
                            {lead.mobile_phone1 && (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id="phone1"
                                  name="phone"
                                  value={lead.mobile_phone1}
                                  checked={phoneNumber === lead.mobile_phone1}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  className="text-blue-600"
                                />
                                <label htmlFor="phone1" className="text-sm">
                                  Primary: {lead.mobile_phone1}
                                </label>
                              </div>
                            )}
                            {lead.mobile_phone2 && (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="radio"
                                  id="phone2"
                                  name="phone"
                                  value={lead.mobile_phone2}
                                  checked={phoneNumber === lead.mobile_phone2}
                                  onChange={(e) => setPhoneNumber(e.target.value)}
                                  className="text-blue-600"
                                />
                                <label htmlFor="phone2" className="text-sm">
                                  Secondary: {lead.mobile_phone2}
                                </label>
                              </div>
                            )}
                            <div className="mt-2">
                              <input
                                type="tel"
                                id="customPhone"
                                className={`w-full p-2 border rounded ${!phoneNumber ? 'border-red-300 bg-red-50' : ''}`}
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+1234567890"
                              />
                              <div className="flex justify-between items-center">
                                <p className="text-xs text-gray-500 mt-1">
                                  Enter phone number in international format (e.g., +1234567890)
                                </p>
                                <div className="bg-blue-50 text-xs text-blue-700 p-1 px-2 rounded mt-1">
                                  Phone will be formatted as: {phoneNumber ? formatPhoneNumber(phoneNumber) : '+1XXXXXXXXXX'}
                                </div>
                              </div>
                              {!phoneNumber && (
                                <p className="text-sm text-red-500 mt-1">
                                  This lead does not have a phone number. Please enter one manually to make a call.
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    
                    <button
                      className="bg-blue-500 text-white px-4 py-2 rounded flex items-center"
                      onClick={handleTestCall}
                      disabled={loading || !phoneNumber}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Placing Call...
                        </>
                      ) : (
                        <>
                          <PhoneCall size={18} className="mr-2" />
                          Place Call
                        </>
                      )}
                    </button>
                    
                    {callResult && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                        <h4 className="font-medium text-green-800">Call Initiated!</h4>
                        <p className="text-sm text-green-700">
                          Call ID: {callResult.call_id || callResult.id}
                        </p>
                        <p className="text-sm text-green-700">
                          Status: {callResult.status || 'Initiated'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">Please select a lead from the list to make a call.</p>
                )}
              </div>
            )}
            
            {activeTab === 'script' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Call Script</h3>
                <CallScriptEditor value={callScript} onChange={setCallScript} />
              </div>
            )}
            
            {activeTab === 'history' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Call History</h3>
                {selectedLead ? (
                  <CallHistory leadId={selectedLead} ngrokUrl={ngrokUrl} />
                ) : (
                  <p className="text-gray-500">Please select a lead to view call history.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 