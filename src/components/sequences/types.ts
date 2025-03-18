import { Mail, Phone, Linkedin, Clock, CheckCircle, XCircle } from 'lucide-react';

export interface Sequence {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version: number;
  steps: SequenceStep[];
  leads?: LeadSequence[];
}

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  title: string | null;
}

export interface LeadSequence {
  lead: Lead;
  current_step: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  paused_at: string | null;
  decision_path?: string;
}

export interface DecisionPath {
  id: string;
  label: 'Replied' | 'No Reply';
  next_step: number | null;
}

export interface CallScript {
  greeting: string;
  introduction: string;
  talking_points: string[];
  questions: string[];
  closing: string;
  voice: string;
  ai_model: string;
  caller_phone_number?: string;
}

export interface SequenceStep {
  id: string;
  step_type: 'email' | 'linkedin_request' | 'call';
  step_order: number;
  configuration: {
    template?: string;
    subject?: string;
    message?: string;
    notes?: string;
    wait_time?: number;
    wait_time_unit?: 'minutes' | 'hours' | 'days';
    paths?: DecisionPath[];
    call_script?: CallScript;
  };
}

export const WAIT_TIME_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
];

export const STEP_TYPES = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'linkedin_request', label: 'LinkedIn', icon: Linkedin },
];

export const DECISION_PATH_LABELS = ['Replied', 'No Reply'] as const;

export const DEFAULT_DECISION_PATHS: DecisionPath[] = [
  { id: 'replied', label: 'Replied', next_step: null },
  { id: 'no_reply', label: 'No Reply', next_step: null }
];

export const PLACEHOLDER_KEYWORDS = [
  { keyword: '{{firstName}}', description: 'Lead\'s first name' },
  { keyword: '{{lastName}}', description: 'Lead\'s last name' },
  { keyword: '{{fullName}}', description: 'Lead\'s full name' },
  { keyword: '{{email}}', description: 'Lead\'s email address' },
  { keyword: '{{company}}', description: 'Lead\'s company name' },
  { keyword: '{{title}}', description: 'Lead\'s job title' },
  { keyword: '{{location}}', description: 'Lead\'s location' },
  { keyword: '{{linkedin}}', description: 'Lead\'s LinkedIn URL' },
];

export const STATUS_ICONS = {
  pending: Clock,
  in_progress: Mail,
  completed: CheckCircle,
  failed: XCircle,
};

export const STATUS_COLORS = {
  pending: 'text-yellow-500',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
};