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
  created_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
  conversations: Conversation[];
};

type Conversation = {
  id: string;
  transcript: string;
  conversation_data: any;
  created_at: string;
};

export default function CallHistory({ leadId, limit = 5, showAll = false, ngrokUrl }: CallHistoryProps) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCalls, setExpandedCalls] = useState<Record<string, boolean>>({});
  
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
                {call.conversations && call.conversations.length > 0 ? (
                  <div>
                    <h4 className="font-medium mb-2">Call Transcript</h4>
                    <div className="border border-gray-200 rounded p-3 max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-sans">
                        {call.conversations[0].transcript || 'No transcript available'}
                      </pre>
                    </div>
                    
                    {call.conversations[0].conversation_data && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Conversation Details</h4>
                        <div className="space-y-2">
                          {Array.isArray(call.conversations[0].conversation_data) && 
                            call.conversations[0].conversation_data.map((turn: any, i: number) => (
                              <div 
                                key={i} 
                                className={`p-2 rounded ${
                                  turn.role === 'assistant' 
                                    ? 'bg-blue-50 border-l-2 border-blue-300' 
                                    : 'bg-gray-50 border-l-2 border-gray-300'
                                }`}
                              >
                                <div className="text-xs font-semibold mb-1">
                                  {turn.role === 'assistant' ? 'AI Assistant' : 'Lead'}
                                </div>
                                <div className="text-sm">{turn.content}</div>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
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