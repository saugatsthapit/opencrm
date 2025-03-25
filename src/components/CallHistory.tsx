import React, { useState, useEffect } from 'react';
import { Play, Download, ChevronDown, ChevronUp, Phone, PhoneOff, PhoneMissed } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCallHistory } from '../lib/vapi';
import { getApiBaseUrl } from '../config/env';

type CallHistoryProps = {
  leadId?: string;
  limit?: number;
  showAll?: boolean;
  ngrokUrl?: string;
};

type Call = {
  id: string;
  call_id: string;
  phone_number: string;
  status: string;
  duration: number;
  recording_url: string;
  stereo_recording_url?: string;
  created_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
  summary?: string;
  ended_reason?: string;
  interest_status?: string;
  notes?: string;
  cost?: number;
  cost_breakdown?: any;
  metadata?: any;
  conversations: Conversation[];
};

type Conversation = {
  id: string;
  transcript: string;
  conversation_data: any;
  messages?: any[];
  created_at: string;
  analysis?: any;
};

export default function CallHistory({ leadId, limit = 5, showAll = false, ngrokUrl }: CallHistoryProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean | string>>({});
  
  useEffect(() => {
    async function fetchCalls() {
      try {
        setLoading(true);
        setError(null);
        
        // If leadId is provided, try to fetch from API first
        if (leadId) {
          try {
            // Use the getApiBaseUrl utility
            const apiBaseUrl = getApiBaseUrl();
            console.log(`Fetching call history with API base URL: ${apiBaseUrl}`);
            
            const response = await fetch(`${apiBaseUrl}/calls/history/${leadId}`);
            if (response.ok) {
              const apiResponse = await response.json();
              if (apiResponse && apiResponse.success && apiResponse.data) {
                setCalls(apiResponse.data || []);
                setLoading(false);
                return;
              }
            }
          } catch (apiErr) {
            console.warn('Failed to fetch from API, falling back to Supabase:', apiErr);
            // Continue with Supabase fallback
          }
        }
        
        // Fallback to Supabase direct query
        let query = supabase
          .from('call_tracking')
          .select(`
            *,
            conversations:call_conversations(*)
          `)
          .order('created_at', { ascending: false });
        
        if (leadId) {
          query = query.eq('lead_id', leadId);
        }
        
        if (!showAll) {
          query = query.limit(limit);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        setCalls(data || []);
      } catch (err: any) {
        console.error('Error fetching call history:', err);
        setError(err.message || 'Failed to load call history');
      } finally {
        setLoading(false);
      }
    }
    
    fetchCalls();
  }, [leadId, limit, showAll, ngrokUrl]);
  
  const toggleCallExpand = (callId: string) => {
    setExpandedCalls(prev => ({
      ...prev,
      [callId]: !prev[callId]
    }));
  };
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };
  
  const getStatusIcon = (call: Call) => {
    if (call.failed_at) {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    } else if (call.completed_at) {
      return <Phone className="w-4 h-4 text-green-500" />;
    } else if (call.started_at) {
      return <Phone className="w-4 h-4 text-blue-500" />;
    } else {
      return <PhoneOff className="w-4 h-4 text-gray-500" />;
    }
  };
  
  const getStatusText = (call: Call) => {
    if (call.status === 'failed' || call.status === 'busy' || call.status === 'no-answer') {
      return <span className="text-red-500">{call.status}</span>;
    } else if (call.status === 'completed') {
      return <span className="text-green-500">Completed</span>;
    } else if (call.status === 'in-progress') {
      return <span className="text-blue-500">In Progress</span>;
    } else {
      return <span className="text-gray-500">{call.status || 'Pending'}</span>;
    }
  };
  
  if (loading) {
    return <div className="py-4 text-center text-gray-500">Loading call history...</div>;
  }
  
  if (error) {
    return <div className="py-4 text-center text-red-500">Error: {error}</div>;
  }
  
  if (calls.length === 0) {
    return <div className="py-4 text-center text-gray-500">No calls found</div>;
  }
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Call History</h3>
      
      <div className="space-y-3">
        {calls.map(call => (
          <div key={call.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="px-4 py-3 bg-gray-50 flex justify-between items-center cursor-pointer"
              onClick={() => toggleCallExpand(call.id)}
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(call)}
                <div>
                  <div className="font-medium">{call.phone_number}</div>
                  <div className="text-sm text-gray-500">
                    {formatTime(call.created_at)} • {getStatusText(call)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {call.duration && (
                  <div className="text-sm text-gray-500">
                    {formatDuration(call.duration)}
                  </div>
                )}
                
                {call.recording_url && (
                  <a
                    href={call.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
                
                {expandedCalls[call.id] ? (
                  <ChevronUp className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            
            {expandedCalls[call.id] && (
              <div className="px-4 py-3 bg-white border-t border-gray-200">
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Call Details</h4>
                    <div className="border border-gray-200 rounded p-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-gray-500">Duration:</div>
                        <div>{formatDuration(call.duration || 0)}</div>
                        
                        <div className="text-gray-500">Status:</div>
                        <div>{call.status}</div>
                        
                        <div className="text-gray-500">Started:</div>
                        <div>{formatTime(call.started_at)}</div>
                        
                        <div className="text-gray-500">Ended:</div>
                        <div>{formatTime(call.completed_at)}</div>
                        
                        {call.ended_reason && (
                          <>
                            <div className="text-gray-500">End Reason:</div>
                            <div>{call.ended_reason}</div>
                          </>
                        )}
                        
                        {call.metadata && (
                          <>
                            <div className="text-gray-500">Lead ID:</div>
                            <div>{call.metadata.lead_id || 'N/A'}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Recordings</h4>
                    <div className="border border-gray-200 rounded p-3">
                      {call.recording_url ? (
                        <div className="space-y-2">
                          <div>
                            <audio 
                              controls 
                              className="w-full" 
                              src={call.recording_url}
                            >
                              Your browser does not support the audio element.
                            </audio>
                            <div className="text-xs text-gray-500 mt-1">Mono Recording</div>
                          </div>
                          
                          {call.stereo_recording_url && (
                            <div>
                              <audio 
                                controls 
                                className="w-full" 
                                src={call.stereo_recording_url}
                              >
                                Your browser does not support the audio element.
                              </audio>
                              <div className="text-xs text-gray-500 mt-1">Stereo Recording (AI + Customer separated)</div>
                            </div>
                          )}
                          
                          <div className="mt-2 flex space-x-2">
                            <a 
                              href={call.recording_url} 
                              target="_blank"
                              rel="noopener noreferrer" 
                              className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download Mono
                            </a>
                            
                            {call.stereo_recording_url && (
                              <a 
                                href={call.stereo_recording_url} 
                                target="_blank"
                                rel="noopener noreferrer" 
                                className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Download Stereo
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 py-2">No recordings available</div>
                      )}
                    </div>
                  </div>
                </div>
                
                {call.summary && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Call Summary</h4>
                    <div className="border border-gray-200 bg-yellow-50 rounded p-3">
                      {call.summary}
                    </div>
                  </div>
                )}
                
                {call.notes && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Notes</h4>
                    <div className="border border-gray-200 bg-gray-50 rounded p-3">
                      {call.notes}
                    </div>
                  </div>
                )}
                
                {call.interest_status && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Interest Level</h4>
                    <div className={`inline-block px-3 py-1 rounded-full text-sm ${
                      call.interest_status === 'green' ? 'bg-green-100 text-green-800' :
                      call.interest_status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      call.interest_status === 'red' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {call.interest_status.charAt(0).toUpperCase() + call.interest_status.slice(1)}
                    </div>
                  </div>
                )}
                
                {call.cost !== undefined && (
                  <div className="mb-4">
                    <h4 className="font-medium mb-2">Call Costs</h4>
                    <div className="border border-gray-200 rounded p-3 text-sm">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="text-gray-500">Total Cost:</div>
                        <div>${call.cost.toFixed(4)}</div>
                        
                        {call.cost_breakdown && (
                          <>
                            {call.cost_breakdown.stt !== undefined && (
                              <>
                                <div className="text-gray-500">Speech-to-Text:</div>
                                <div>${call.cost_breakdown.stt.toFixed(4)}</div>
                              </>
                            )}
                            
                            {call.cost_breakdown.llm !== undefined && (
                              <>
                                <div className="text-gray-500">LLM:</div>
                                <div>${call.cost_breakdown.llm.toFixed(4)}</div>
                              </>
                            )}
                            
                            {call.cost_breakdown.tts !== undefined && (
                              <>
                                <div className="text-gray-500">Text-to-Speech:</div>
                                <div>${call.cost_breakdown.tts.toFixed(4)}</div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {call.conversations && call.conversations.length > 0 ? (
                  <div>
                    <h4 className="font-medium mb-2">Conversation</h4>
                    <div className="border border-gray-200 rounded">
                      <div className="flex border-b border-gray-200">
                        <button 
                          className={`px-4 py-2 text-sm font-medium ${
                            expandedCalls[`${call.id}-tab`] !== 'structured' ? 
                            'bg-blue-50 border-b-2 border-blue-500' : 
                            'text-gray-500'
                          }`}
                          onClick={() => setExpandedCalls(prev => ({
                            ...prev, 
                            [`${call.id}-tab`]: 'messages'
                          }))}
                        >
                          Messages
                        </button>
                        <button 
                          className={`px-4 py-2 text-sm font-medium ${
                            expandedCalls[`${call.id}-tab`] === 'structured' ? 
                            'bg-blue-50 border-b-2 border-blue-500' : 
                            'text-gray-500'
                          }`}
                          onClick={() => setExpandedCalls(prev => ({
                            ...prev, 
                            [`${call.id}-tab`]: 'structured'
                          }))}
                        >
                          Raw Transcript
                        </button>
                      </div>
                      
                      {expandedCalls[`${call.id}-tab`] !== 'structured' ? (
                        <div className="p-3">
                          {call.conversations[0].messages && Array.isArray(call.conversations[0].messages) && call.conversations[0].messages.length > 0 ? (
                            <div className="space-y-2">
                              {call.conversations[0].messages.map((msg: any, i: number) => (
                                <div 
                                  key={i} 
                                  className={`p-2 rounded ${
                                    msg.role === 'bot' || msg.role === 'assistant' || msg.role === 'system'
                                      ? 'bg-blue-50 border-l-2 border-blue-300 ml-8' 
                                      : 'bg-gray-50 border-l-2 border-gray-300 mr-8'
                                  }`}
                                >
                                  <div className="text-xs font-semibold mb-1 flex justify-between">
                                    <span>
                                      {msg.role === 'bot' || msg.role === 'assistant' ? 'AI Assistant' : 
                                       msg.role === 'system' ? 'System' : 'Customer'}
                                    </span>
                                    {(msg.time || msg.timestamp) && (
                                      <span className="text-gray-500">
                                        {new Date(msg.time || msg.timestamp).toLocaleTimeString()}
                                      </span>
                                    )}
                                    {msg.duration && (
                                      <span className="text-gray-500 ml-2">
                                        ({(msg.duration / 1000).toFixed(1)}s)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm">{msg.message || msg.content}</div>
                                </div>
                              ))}
                            </div>
                          ) : call.conversations[0].conversation_data && Array.isArray(call.conversations[0].conversation_data) ? (
                            <div className="space-y-2">
                              {call.conversations[0].conversation_data.map((turn: any, i: number) => (
                                <div 
                                  key={i} 
                                  className={`p-2 rounded ${
                                    turn.role === 'assistant' 
                                      ? 'bg-blue-50 border-l-2 border-blue-300 ml-8' 
                                      : 'bg-gray-50 border-l-2 border-gray-300 mr-8'
                                  }`}
                                >
                                  <div className="text-xs font-semibold mb-1">
                                    {turn.role === 'assistant' ? 'AI Assistant' : 'Customer'}
                                  </div>
                                  <div className="text-sm">{turn.content}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-gray-500 py-2">No structured messages available</div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 max-h-96 overflow-y-auto">
                          <pre className="text-sm whitespace-pre-wrap font-sans">
                            {call.conversations[0].transcript || 'No transcript available'}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 py-2">No transcript available for this call.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {!showAll && calls.length >= limit && (
        <div className="text-center">
          <a href="#" className="text-blue-500 hover:text-blue-700 text-sm">
            View all calls
          </a>
        </div>
      )}
    </div>
  );
} 