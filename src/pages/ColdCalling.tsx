import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, History, Settings, List, CheckCircle, Users } from 'lucide-react';
import CallScriptEditor from '../components/CallScriptEditor';
import CallHistory from '../components/CallHistory';
import { defaultCallScript, placeCall, setNgrokUrl, clearNgrokSettings } from '../lib/vapi';
import { supabase } from '../lib/supabase';
import { useLocation } from 'react-router-dom';

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
  
  // Batch calling state
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [batchCallInProgress, setBatchCallInProgress] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [batchCallResults, setBatchCallResults] = useState<any[]>([]);

  const isProduction = window.location.hostname === 'fastcrm.netlify.app';
  const hasNgrokConfigured = isProduction && localStorage.getItem('ngrok_url');

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
        setSelectedLeads(location.state.selectedLeads);
        
        // Set the active tab to 'batch'
        setActiveTab('batch');
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

  const handleTestCall = async (phoneNumber: string) => {
    if (!selectedLead) {
      setError('Please select a lead first');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCallResult(null);

      // Format the phone number before making the call
      const formattedNumber = formatPhoneNumber(phoneNumber);

      const response = await placeCall(
        formattedNumber,
        selectedLead,
        callScript
      );

      setCallResult(response);
      
      // Mark this lead as called
      setLeads(prevLeads => 
        prevLeads.map(l => 
          l.id === selectedLead ? { ...l, called: true } : l
        )
      );
      
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
  
  // Toggle a lead's selection for batch calling
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };
  
  // Helper to check if a lead has a valid phone number
  const hasValidPhone = (leadId: string): boolean => {
    const lead = leads.find(l => l.id === leadId);
    return !!lead?.mobile_phone1;
  };
  
  // Start batch calling process
  const startBatchCalling = async () => {
    if (selectedLeads.length === 0) {
      setError('Please select at least one lead to call');
      return;
    }
    
    // Check if any of the selected leads have phone numbers
    const leadsWithPhones = selectedLeads.filter(id => hasValidPhone(id));
    
    if (leadsWithPhones.length === 0) {
      setError('None of the selected leads have phone numbers. Please add phone numbers first.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setBatchCallResults([]);
      
      // Call the batch API endpoint
      const response = await fetch('/api/v1/calls/place-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_ids: leadsWithPhones, // Only send leads with phone numbers
          call_script: callScript
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate batch calls');
      }
      
      // Set batch calling in progress
      setBatchCallInProgress(true);
      
      // If first call was placed, set current index to 0
      if (data.data.first_call_placed) {
        setCurrentBatchIndex(0);
        
        // Find the lead that was called and mark it
        const firstCalledLead = data.data.leads.find((lead: any) => !lead.queued && lead.success);
        if (firstCalledLead) {
          setLeads(prevLeads => 
            prevLeads.map(l => 
              l.id === firstCalledLead.lead_id ? { ...l, called: true } : l
            )
          );
          
          // Store call result
          setBatchCallResults([firstCalledLead.call_result]);
          
          // Set current call result
          setCallResult(firstCalledLead.call_result);
        }
      }
      
      // Display any errors for specific leads
      data.data.leads.forEach((leadResult: any) => {
        if (!leadResult.success) {
          console.error(`Error with lead ${leadResult.lead_id}: ${leadResult.message}`);
        }
      });
      
    } catch (err: any) {
      console.error('Error initiating batch calls:', err);
      setError(err.message);
      setBatchCallInProgress(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Call the next lead in the batch
  const callNextLead = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const nextIndex = currentBatchIndex + 1;
      
      if (nextIndex >= selectedLeads.length) {
        // End of batch
        setBatchCallInProgress(false);
        setCurrentBatchIndex(-1);
        setLoading(false);
        return;
      }
      
      // Get the next lead ID
      const nextLeadId = selectedLeads[nextIndex];
      
      // Skip leads without phone numbers
      if (!hasValidPhone(nextLeadId)) {
        console.warn(`Skipping lead ${nextLeadId} due to missing phone number`);
        // Recursively try the next lead
        setCurrentBatchIndex(nextIndex);
        setLoading(false);
        callNextLead();
        return;
      }
      
      // Find the lead
      const lead = leads.find(l => l.id === nextLeadId);
      
      if (!lead) {
        throw new Error('Next lead not found');
      }
      
      // Make the call (we already verified phone exists) and format the number
      const formattedNumber = formatPhoneNumber(lead.mobile_phone1!);
      const response = await placeCall(
        formattedNumber,
        lead.id,
        callScript
      );
      
      // Update state
      setCurrentBatchIndex(nextIndex);
      setBatchCallResults(prev => [...prev, response]);
      setCallResult(response);
      
      // Mark this lead as called
      setLeads(prevLeads => 
        prevLeads.map(l => 
          l.id === lead.id ? { ...l, called: true } : l
        )
      );
      
    } catch (err: any) {
      console.error('Error initiating next call:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
              {activeTab === 'batch' && (
                <div className="mb-4">
                  <p className="text-sm mb-2">Selected: {selectedLeads.length} leads</p>
                  <div className="flex justify-between items-center">
                    <button
                      className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                      onClick={() => setSelectedLeads(leads.map(l => l.id))}
                    >
                      Select All
                    </button>
                    <button
                      className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                      onClick={() => setSelectedLeads([])}
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}
              
              <ul className="divide-y divide-gray-200">
                {leads.map((lead) => (
                  <li 
                    key={lead.id} 
                    className={`py-2 px-2 cursor-pointer hover:bg-gray-50 ${
                      (selectedLead === lead.id && activeTab !== 'batch') || 
                      (activeTab === 'batch' && selectedLeads.includes(lead.id)) 
                        ? 'bg-blue-50' 
                        : ''
                    }`}
                    onClick={() => {
                      if (activeTab === 'batch') {
                        toggleLeadSelection(lead.id);
                      } else {
                        handleLeadSelection(lead.id);
                      }
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
                      {activeTab === 'batch' && (
                        <div className="flex items-center">
                          {lead.called && (
                            <span className="inline-block rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs mr-2">
                              Called
                            </span>
                          )}
                          <input 
                            type="checkbox" 
                            className="h-4 w-4"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLeads(prev => [...prev, lead.id]);
                              } else {
                                setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                              }
                              e.stopPropagation();
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      )}
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
              className={`px-4 py-2 flex items-center ${activeTab === 'batch' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => setActiveTab('batch')}
            >
              <Users size={18} className="mr-2" />
              Batch Calling
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
                      onClick={() => handleTestCall(phoneNumber)}
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
            
            {activeTab === 'batch' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Batch Calling</h3>
                
                <div className="mb-4">
                  <p>Select multiple leads from the list to include in your batch call.</p>
                  
                  {/* Count and show warning for leads without phone numbers */}
                  {selectedLeads.length > 0 && (() => {
                    const leadsWithoutPhone = selectedLeads.filter(id => {
                      const lead = leads.find(l => l.id === id);
                      return !lead?.mobile_phone1;
                    });
                    
                    if (leadsWithoutPhone.length > 0) {
                      return (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <p className="text-sm text-yellow-700">
                            <span className="font-medium">Warning:</span> {leadsWithoutPhone.length} of {selectedLeads.length} selected 
                            {leadsWithoutPhone.length === 1 ? ' lead does ' : ' leads do '} 
                            not have a phone number and will be skipped.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {batchCallInProgress && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <h4 className="font-medium text-blue-800">Batch Calling In Progress</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Currently calling lead {currentBatchIndex + 1} of {selectedLeads.length}
                      </p>
                      <p className="text-sm text-blue-700">
                        Lead: {getLeadName(selectedLeads[currentBatchIndex])}
                      </p>
                    </div>
                  )}
                  
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
                
                <div className="flex mt-6">
                  {batchCallInProgress ? (
                    <button
                      className="bg-blue-500 text-white px-4 py-2 rounded flex items-center"
                      onClick={callNextLead}
                      disabled={loading || currentBatchIndex >= selectedLeads.length - 1}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Calling Next...
                        </>
                      ) : (
                        <>
                          <PhoneCall size={18} className="mr-2" />
                          Call Next Lead
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      className="bg-blue-500 text-white px-4 py-2 rounded flex items-center"
                      onClick={startBatchCalling}
                      disabled={loading || selectedLeads.length === 0}
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <List size={18} className="mr-2" />
                          Start Batch Calling ({selectedLeads.length} leads)
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {batchCallResults.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Batch Call Results:</h4>
                    <ul className="divide-y divide-gray-200 border rounded">
                      {batchCallResults.map((result, index) => (
                        <li key={index} className="p-3">
                          <div className="flex items-center">
                            <CheckCircle size={16} className="text-green-500 mr-2" />
                            <p className="text-sm">
                              Lead: {getLeadName(selectedLeads[index])} - 
                              Call ID: {result.call_id || result.id} - 
                              Status: {result.status || 'Initiated'}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                  <CallHistory leadId={selectedLead} />
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