import React, { useState, useEffect } from 'react';
import { Phone, PhoneCall, History, Settings } from 'lucide-react';
import CallScriptEditor from '../components/CallScriptEditor';
import CallHistory from '../components/CallHistory';
import { defaultCallScript, placeCall } from '../lib/vapi';
import { supabase } from '../lib/supabase';

export default function ColdCalling() {
  const [activeTab, setActiveTab] = useState('calls');
  const [callScript, setCallScript] = useState(defaultCallScript);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError('Network connection error: Unable to reach the API server. Make sure the server is running at http://localhost:8001 and the Vite proxy is configured correctly.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const getLeadName = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return 'Unknown Lead';
    return `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || 'Unknown';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Phone className="mr-2 h-6 w-6" />
          Cold Calling System
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              className={`py-4 px-6 ${
                activeTab === 'calls'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('calls')}
            >
              <PhoneCall className="w-5 h-5 inline mr-2" />
              Make Calls
            </button>
            <button
              className={`py-4 px-6 ${
                activeTab === 'history'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('history')}
            >
              <History className="w-5 h-5 inline mr-2" />
              Call History
            </button>
            <button
              className={`py-4 px-6 ${
                activeTab === 'settings'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="w-5 h-5 inline mr-2" />
              Settings
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'calls' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-lg font-medium mb-4">Select a Lead to Call</h3>
                
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                
                {callResult && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
                    Call initiated successfully! Call ID: {callResult.call_id || callResult.call?.call_id}
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Lead</label>
                  <select
                    className="w-full rounded-md border-gray-300"
                    value={selectedLead || ''}
                    onChange={(e) => setSelectedLead(e.target.value)}
                  >
                    <option value="">Select a lead</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {`${lead.first_name || ''} ${lead.last_name || ''} ${
                          lead.phone ? `(${lead.phone})` : ''
                        }`}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedLead && (
                  <div>
                    <h4 className="font-medium mb-2">Selected Lead: {getLeadName(selectedLead)}</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Customize your call script for this lead below. You can use placeholders like {"{{"} firstName {"}}"}  or {"{{"} company {"}}"}
                      in your script, which will be replaced with the lead's actual information.
                    </p>
                  </div>
                )}
              </div>
              
              {selectedLead && (
                <CallScriptEditor
                  value={callScript}
                  onChange={setCallScript}
                  onTestCall={handleTestCall}
                />
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {selectedLead ? (
                <CallHistory leadId={selectedLead} showAll={true} />
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-800">Select a lead to view call history</h3>
                  <p className="text-gray-500">
                    Please select a lead from the "Make Calls" tab to view their call history.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Cold Calling Settings</h3>
              
              <div className="space-y-6">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                  <p className="text-blue-700">
                    <span className="font-bold">Note:</span> The API keys are configured in your server's .env file.
                    If you need to change them, you'll need to update the .env file and restart the server.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium mb-2">Twilio Configuration</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between">
                        <span className="text-gray-600">Purpose:</span>
                        <span className="font-medium">Phone Number Provider</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Phone Number:</span>
                        <span className="font-medium">+18623977169</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium text-green-600">Connected</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium mb-2">VAPI Configuration</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex justify-between">
                        <span className="text-gray-600">Purpose:</span>
                        <span className="font-medium">Voice AI Conversation</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Default Voice:</span>
                        <span className="font-medium">Shimmer (Female)</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-gray-600">Default AI Model:</span>
                        <span className="font-medium">GPT-4</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Integration Status</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    This system uses a hybrid approach: Twilio for phone number and call mechanics, 
                    while VAPI provides the voice AI conversation capabilities.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex justify-between">
                      <span className="text-gray-600">Server Status:</span>
                      <span className="font-medium text-green-600">Running on Port 8001</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-gray-600">Supabase Status:</span>
                      <span className="font-medium text-green-600">Connected</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-gray-600">Webhooks:</span>
                      <span className="font-medium">Configured for Call Events</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 