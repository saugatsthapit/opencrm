import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Info, Phone, CheckCircle, XCircle, AlertCircle, UserPlus } from 'lucide-react';
import { toast } from "react-hot-toast";
import { useRouter } from 'next/navigation';

// Define interfaces for our component
interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  title?: string;
  created_at: string;
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
  call_status: string;
  tracking_id: string;
}

export default function ColdCallingPage() {
  const supabase = useSupabaseClient<Database>();
  const router = useRouter();
  
  // State for leads, call scripts, and form inputs
  const [leads, setLeads] = useState<Lead[]>([]);
  const [callScripts, setCallScripts] = useState<CallScript[]>([]);
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [selectedScript, setSelectedScript] = useState<string>('');
  const [customPhoneNumber, setCustomPhoneNumber] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [callResult, setCallResult] = useState<CallResult | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  
  // New script form state
  const [newScript, setNewScript] = useState<CallScript>({
    name: 'New Sales Script',
    greeting: 'Hello {{name}}, this is calling from AI Sales Assistant.',
    introduction: 'I\'m calling today about our solution that helps businesses like {{company}} improve their sales automation.',
    talking_points: [
      'Our platform helps businesses increase revenue by 30% on average.',
      'We specialize in helping companies in the {{industry}} industry.',
      'Our solution integrates with your existing tools and workflows.'
    ],
    questions: [
      'Is now a good time to talk about how we could help your business?',
      'What challenges are you currently facing with your sales process?',
      'Would you be interested in learning more about our solution?'
    ],
    closing: 'Thank you for your time today. I\'d be happy to schedule a follow-up call to discuss this further.',
    voice: 'shimmer',
    ai_model: 'gpt-4'
  });
  
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
      
      setLeads(data || []);
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
      if (data && data.length > 0) {
        setSelectedScript(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching call scripts:', error);
      toast.error('Failed to load call scripts');
    }
  };
  
  // Save a new call script to Supabase
  const saveCallScript = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('call_scripts')
        .insert([
          {
            name: newScript.name,
            greeting: newScript.greeting,
            introduction: newScript.introduction,
            talking_points: newScript.talking_points,
            questions: newScript.questions,
            closing: newScript.closing,
            voice: newScript.voice,
            ai_model: newScript.ai_model
          }
        ])
        .select();
      
      if (error) throw error;
      
      toast.success('Call script saved successfully!');
      fetchCallScripts();
      
      // Select the newly created script
      if (data && data.length > 0) {
        setSelectedScript(data[0].id);
      }
    } catch (error) {
      console.error('Error saving call script:', error);
      toast.error('Failed to save call script');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initiate a call to the selected lead
  const initiateCall = async () => {
    try {
      setIsLoading(true);
      setCallError(null);
      setCallResult(null);
      
      // Find the selected lead and script
      const lead = leads.find(l => l.id === selectedLead);
      const script = callScripts.find(s => s.id === selectedScript);
      
      if (!lead) {
        throw new Error('Please select a lead');
      }
      
      if (!script) {
        throw new Error('Please select a call script');
      }
      
      // Use custom phone number if provided, otherwise use lead's phone
      const phoneNumber = customPhoneNumber || lead.phone;
      
      if (!phoneNumber) {
        throw new Error('No phone number provided. Please enter a custom phone number.');
      }
      
      const response = await fetch('/api/v1/calls/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          lead_id: lead.id,
          call_script: script
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate call');
      }
      
      toast.success('Call initiated successfully!');
      setCallResult(data.data);
    } catch (error: any) {
      console.error('Error initiating call:', error);
      setCallError(error.message || 'Failed to initiate call');
      toast.error(error.message || 'Failed to initiate call');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check if we're running in production
  const isProduction = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    !window.location.hostname.includes('ngrok');
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Cold Calling</h1>
      
      {isProduction && (
        <Alert variant="warning" className="bg-amber-50 border-amber-500">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Attention</AlertTitle>
          <AlertDescription>
            Cold calling features are now powered by VAPI.ai and make real phone calls. 
            This requires proper setup and API keys to function. A VAPI API key has been pre-configured for testing.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Make a Call</CardTitle>
          <CardDescription>
            Select a lead and a script to make a cold call using AI voice technology.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lead">Select Lead</Label>
              <select
                id="lead"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedLead}
                onChange={(e) => setSelectedLead(e.target.value)}
              >
                <option value="">Select a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.first_name} {lead.last_name} - {lead.company_name || 'No Company'}
                  </option>
                ))}
              </select>
              
              {selectedLead && (
                <div className="mt-4 text-sm space-y-2">
                  <p><strong>Phone:</strong> {leads.find(l => l.id === selectedLead)?.phone || 'No phone number'}</p>
                  <p><strong>Email:</strong> {leads.find(l => l.id === selectedLead)?.email || 'No email'}</p>
                  <p><strong>Company:</strong> {leads.find(l => l.id === selectedLead)?.company_name || 'No company'}</p>
                </div>
              )}
              
              <div className="mt-4">
                <Label htmlFor="customPhone">Custom Phone Number (Optional)</Label>
                <Input
                  id="customPhone"
                  placeholder="e.g. +1234567890"
                  value={customPhoneNumber}
                  onChange={(e) => setCustomPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a custom phone number if you want to override the lead's phone.
                </p>
              </div>
            </div>
            
            <div>
              <Label htmlFor="script">Select Call Script</Label>
              <select
                id="script"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedScript}
                onChange={(e) => setSelectedScript(e.target.value)}
              >
                <option value="">Select a script</option>
                {callScripts.map((script) => (
                  <option key={script.id} value={script.id}>
                    {script.name}
                  </option>
                ))}
              </select>
              
              {selectedScript && (
                <div className="mt-4 text-sm space-y-2">
                  <p><strong>Greeting:</strong> {callScripts.find(s => s.id === selectedScript)?.greeting}</p>
                  <p><strong>Introduction:</strong> {callScripts.find(s => s.id === selectedScript)?.introduction}</p>
                  <p><strong>Talking Points:</strong> {callScripts.find(s => s.id === selectedScript)?.talking_points.join(', ')}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/leads/add')}>
            <UserPlus className="mr-2 h-4 w-4" /> Add New Lead
          </Button>
          <Button onClick={initiateCall} disabled={isLoading}>
            <Phone className="mr-2 h-4 w-4" /> {isLoading ? 'Initiating Call...' : 'Make Call'}
          </Button>
        </CardFooter>
      </Card>
      
      {callResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Call Initiated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Call ID:</strong> {callResult.call_id}</p>
              <p><strong>Status:</strong> {callResult.call_status}</p>
              <p><strong>Tracking ID:</strong> {callResult.tracking_id}</p>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Call Information</AlertTitle>
                <AlertDescription>
                  Your call has been initiated. The AI assistant will handle the conversation based on your script.
                  Call recordings and transcripts will be available after the call is completed.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
      
      {callError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{callError}</AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Create New Call Script</CardTitle>
          <CardDescription>Create a customized script for your cold calls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="scriptName">Script Name</Label>
            <Input
              id="scriptName"
              value={newScript.name}
              onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="greeting">Greeting</Label>
            <Input
              id="greeting"
              value={newScript.greeting}
              onChange={(e) => setNewScript({ ...newScript, greeting: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use {{name}}, {{firstName}}, {{company}} as placeholders for lead data.
            </p>
          </div>
          
          <div>
            <Label htmlFor="introduction">Introduction</Label>
            <Textarea
              id="introduction"
              rows={3}
              value={newScript.introduction}
              onChange={(e) => setNewScript({ ...newScript, introduction: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="talkingPoints">Talking Points (one per line)</Label>
            <Textarea
              id="talkingPoints"
              rows={5}
              value={newScript.talking_points.join('\n')}
              onChange={(e) => setNewScript({
                ...newScript,
                talking_points: e.target.value.split('\n').filter(line => line.trim() !== '')
              })}
            />
          </div>
          
          <div>
            <Label htmlFor="questions">Questions (one per line)</Label>
            <Textarea
              id="questions"
              rows={5}
              value={newScript.questions.join('\n')}
              onChange={(e) => setNewScript({
                ...newScript,
                questions: e.target.value.split('\n').filter(line => line.trim() !== '')
              })}
            />
          </div>
          
          <div>
            <Label htmlFor="closing">Closing</Label>
            <Textarea
              id="closing"
              rows={3}
              value={newScript.closing}
              onChange={(e) => setNewScript({ ...newScript, closing: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="voice">AI Voice</Label>
              <select 
                id="voice"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={newScript.voice}
                onChange={(e) => setNewScript({ ...newScript, voice: e.target.value })}
              >
                <option value="shimmer">Shimmer (Female)</option>
                <option value="fable">Fable (Male)</option>
                <option value="onyx">Onyx (Male)</option>
                <option value="nova">Nova (Female)</option>
                <option value="ember">Ember (Male)</option>
                <option value="alloy">Alloy (Neutral)</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="model">AI Model</Label>
              <select 
                id="model"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={newScript.ai_model}
                onChange={(e) => setNewScript({ ...newScript, ai_model: e.target.value })}
              >
                <option value="gpt-4">GPT-4 (Most Capable)</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</option>
                <option value="claude-3">Claude 3 (Natural)</option>
              </select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveCallScript} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Script'}
          </Button>
        </CardFooter>
      </Card>
      
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