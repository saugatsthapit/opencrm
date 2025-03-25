import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Info, Phone, CheckCircle, XCircle, AlertCircle, UserPlus, List, PhoneOutgoing } from 'lucide-react';
import { toast } from "react-hot-toast";
import { useRouter } from 'next/navigation';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Import our new components
import LeadSelector from '@/components/LeadSelector';
import PhoneNumberInput from '@/components/PhoneNumberInput';
import CallControls from '@/components/CallControls';
import BatchCallControls from '@/components/BatchCallControls';
import CallHistory from '@/components/CallHistory';
import CallScriptEditor from '@/components/CallScriptEditor';

// Define interfaces for our component
interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone1: string | null;
  mobile_phone2: string | null;
  title: string | null;
  created_at: string;
  called: boolean;
}

interface CallScript {
  id?: string;
  name: string;
  greeting: string;
  introduction: string;
  talking_points: string[];
  questions: string[];
  closing: string;
  voice?: string;
  ai_model?: string;
}

interface CallResult {
  call_id: string;
  status: string;
  tracking_id?: string;
}

interface BatchCallResult {
  lead_id: string;
  success: boolean;
  queued: boolean;
  message?: string;
}

export default function ColdCallingPage() {
  const router = useRouter();
  const supabase = useSupabaseClient<Database>();
  
  // State variables
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [customPhoneNumber, setCustomPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [activeTab, setActiveTab] = useState('calls');
  const [newScript, setNewScript] = useState<CallScript>({
    name: '',
    greeting: '',
    introduction: '',
    talking_points: [],
    questions: [],
    closing: ''
  });
  const [batchCallInProgress, setBatchCallInProgress] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(-1);
  const [batchCallResults, setBatchCallResults] = useState<BatchCallResult[]>([]);
  const [ngrokUrl, setNgrokUrl] = useState('');

  // Helper functions
  const getLeadName = (leadId: string): string => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return 'Unknown Lead';
    return `${lead.first_name || ''} ${lead.last_name || ''} ${lead.company_name ? `(${lead.company_name})` : ''}`.trim();
  };

  const handleLeadSelection = (leadId: string) => {
    setSelectedLead(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setCustomPhoneNumber(lead.mobile_phone1 || lead.phone || '');
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleTestCall = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/vapi/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customPhoneNumber,
          leadId: selectedLead
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to place call');
      
      setCallResult(data);
      toast.success('Call initiated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      toast.error('Failed to place call');
    } finally {
      setLoading(false);
    }
  };

  const startBatchCalling = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    setBatchCallInProgress(true);
    setCurrentBatchIndex(0);
    setBatchCallResults([]);
    
    try {
      const response = await fetch('/api/vapi/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeads })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to start batch calling');
      
      setBatchCallResults(data.data.leads);
      
      if (data.data.leads.some((lead: BatchCallResult) => lead.success)) {
        toast.success('Batch calling initiated. First call placed successfully!');
      } else {
        toast.error('Batch calling queue created, but no calls were placed yet.');
      }
      
      data.data.leads.forEach((leadResult: BatchCallResult) => {
        if (!leadResult.success) {
          toast.error(`Error with lead ${leadResult.lead_id}: ${leadResult.message}`);
        }
      });
      
    } catch (err) {
      toast.error('Failed to start batch calling');
      setBatchCallInProgress(false);
      setCurrentBatchIndex(-1);
    }
  };

  const callNextLead = async () => {
    if (currentBatchIndex >= selectedLeads.length - 1) {
      toast.info('All leads in batch have been called');
      setBatchCallInProgress(false);
      setCurrentBatchIndex(-1);
      return;
    }
    
    setCurrentBatchIndex(prev => prev + 1);
    await handleTestCall();
  };

  const saveCallScript = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('call_scripts')
        .insert([newScript])
        .select()
        .single();
        
      if (error) throw error;
      toast.success('Call script saved successfully!');
      setNewScript({
        name: '',
        greeting: '',
        introduction: '',
        talking_points: [],
        questions: [],
        closing: ''
      });
    } catch (err) {
      toast.error('Failed to save call script');
    } finally {
      setLoading(false);
    }
  };

  // Fetch leads and call scripts on component mount
  useEffect(() => {
    fetchLeads();
    fetchCallScripts();
  }, []);
  
  // Fetch leads from Supabase
  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Add selected field to each lead
      const updatedLeads = (data || []).map(lead => ({
        ...lead,
        called: false
      }));
      
      setLeads(updatedLeads);
      if (data && data.length > 0) {
        setSelectedLead(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    }
  };
  
  // Fetch call scripts from Supabase
  const fetchCallScripts = async () => {
    try {
      const { data, error } = await supabase
        .from('call_scripts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setCallScripts(data || []);
    } catch (error) {
      console.error('Error fetching call scripts:', error);
      toast.error('Failed to load call scripts');
    }
  };
  
  // Check if we're running in production
  const isProduction = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    !window.location.hostname.includes('ngrok');
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">Cold Calling</h1>
      
      {isProduction && (
        <Alert variant="warning" className="bg-amber-50 border-amber-500 mb-6">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Attention</AlertTitle>
          <AlertDescription>
            Cold calling features are now powered by VAPI.ai and make real phone calls. 
            This requires proper setup and API keys to function. A VAPI API key has been pre-configured for testing.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lead Selection Panel */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">Leads</h2>
          <LeadSelector
            leads={leads}
            mode={activeTab === 'batch' ? 'batch' : 'single'}
            selectedLeads={activeTab === 'batch' ? selectedLeads : selectedLead ? [selectedLead] : []}
            onLeadSelect={(leadId) => handleLeadSelection(leadId)}
            onLeadToggle={(leadId) => toggleLeadSelection(leadId)}
            loading={loading}
          />
        </div>
        
        {/* Main Content Panel */}
        <div className="col-span-2 bg-white rounded-lg shadow">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="calls">Single Call</TabsTrigger>
              <TabsTrigger value="batch">Batch Calling</TabsTrigger>
              <TabsTrigger value="script">Call Script</TabsTrigger>
              <TabsTrigger value="history">Call History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="calls">
              <Card>
                <CardHeader>
                  <CardTitle>Make a Single Call</CardTitle>
                  <CardDescription>
                    Select a lead and a script to make a cold call using AI voice technology.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedLead ? (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Selected Lead</h3>
                        <p className="text-sm">{getLeadName(selectedLead)}</p>
                      </div>
                      
                      <PhoneNumberInput
                        primaryPhone={leads.find(l => l.id === selectedLead)?.mobile_phone1 || null}
                        secondaryPhone={leads.find(l => l.id === selectedLead)?.mobile_phone2 || null}
                        customPhone={customPhoneNumber}
                        onPhoneChange={setCustomPhoneNumber}
                      />
                      
                      <CallControls
                        onCall={handleTestCall}
                        loading={loading}
                        disabled={!selectedLead || !customPhoneNumber}
                        callResult={callResult}
                        error={error}
                      />
                    </div>
                  ) : (
                    <p className="text-gray-500">Please select a lead from the list to make a call.</p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={() => router.push('/leads/add')}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add New Lead
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="batch">
              <Card>
                <CardHeader>
                  <CardTitle>Batch Calling</CardTitle>
                  <CardDescription>
                    Select multiple leads to call in sequence using the same script.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BatchCallControls
                    selectedLeads={selectedLeads}
                    batchCallInProgress={batchCallInProgress}
                    currentBatchIndex={currentBatchIndex}
                    totalLeads={selectedLeads.length}
                    currentLeadName={currentBatchIndex >= 0 ? getLeadName(selectedLeads[currentBatchIndex]) : ''}
                    loading={loading}
                    onStartBatch={startBatchCalling}
                    onCallNext={callNextLead}
                    batchResults={batchCallResults}
                    getLeadName={getLeadName}
                  />
                </CardContent>
                <CardFooter>
                  <Button variant="outline" onClick={() => router.push('/leads/add')}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add New Lead
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="script">
              <Card>
                <CardHeader>
                  <CardTitle>Call Script</CardTitle>
                  <CardDescription>
                    Create and edit your call scripts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CallScriptEditor value={newScript} onChange={setNewScript} />
                </CardContent>
                <CardFooter>
                  <Button onClick={saveCallScript} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Script'}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Call History</CardTitle>
                  <CardDescription>
                    View call history and recordings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedLead ? (
                    <CallHistory leadId={selectedLead} ngrokUrl={ngrokUrl} />
                  ) : (
                    <p className="text-gray-500">Please select a lead to view call history.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>How Cold Calling Works</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            This system uses VAPI.ai to make real phone calls to your leads with an AI assistant that follows your script.
            The AI will adapt to the conversation naturally while following your talking points and questions.
          </p>
          <p>
            Call recordings and transcripts are saved automatically and can be accessed from the call history.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
} 