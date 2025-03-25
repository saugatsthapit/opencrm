import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, Search, Filter, SendHorizontal, AlertCircle, Trash2, AlertTriangle, Clock, CheckCircle, XCircle, Mail, X, Info, Eye, Phone, User } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  company_employee_count: number | null;
  title: string | null;
  mobile_phone1?: string | null;
  mobile_phone2?: string | null;
  linkedin?: string | null;
  location?: string | null;
  company_domain?: string | null;
  company_website?: string | null;
  company_employee_count_range?: string | null;
  company_founded?: number | null;
  company_industry?: string | null;
  company_type?: string | null;
  company_headquarters?: string | null;
  company_revenue_range?: string | null;
  company_linkedin_url?: string | null;
  sequences?: {
    id: string;
    name: string;
    current_step: number;
    total_steps: number;
    status: string;
  }[];
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
    all_calls?: {
      id: string;
      status: string;
      timestamp: string;
      recording_url?: string;
      success: boolean;
      interest_status?: 'green' | 'yellow' | 'red' | null;
    }[];
  };
}

interface DuplicateNotification {
  show: boolean;
  count: number;
}

const STATUS_COLORS = {
  pending: 'text-yellow-500',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

const STATUS_ICONS = {
  pending: Clock,
  in_progress: Mail,
  completed: CheckCircle,
  failed: XCircle,
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [duplicateNotification, setDuplicateNotification] = useState<DuplicateNotification>({
    show: false,
    count: 0
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        lead_sequences!lead_id (
          id,
          current_step,
          status,
          sequence:sequences (
            id,
            name,
            sequence_steps (
              id
            )
          )
        )
      `);
    
    if (error) {
      console.error('Error fetching leads:', error);
      return;
    }

    // Transform the data to include sequence information
    const transformedLeads = (data || []).map(lead => ({
      ...lead,
      sequences: lead.lead_sequences?.map((ls: any) => ({
        id: ls.sequence.id,
        name: ls.sequence.name,
        current_step: ls.current_step || 0,
        total_steps: ls.sequence.sequence_steps.length,
        status: ls.status || 'pending'
      }))
    }));

    // Fetch call status for each lead
    const leadsWithCallStatus = await Promise.all(transformedLeads.map(async (lead) => {
      try {
        const response = await fetch(`/api/v1/calls/lead/${lead.id}/status`);
        const callStatus = await response.json();
        return {
          ...lead,
          call_status: callStatus
        };
      } catch (err) {
        console.error(`Error fetching call status for lead ${lead.id}:`, err);
        return lead;
      }
    }));

    setLeads(leadsWithCallStatus);
  };

  const isDuplicate = (lead: any, existingLeads: any[], uploadedLeads: any[]) => {
    // Check for duplicates in existing database records
    const existingDuplicate = existingLeads.some(existing => 
      existing.first_name?.toLowerCase() === lead.first_name?.toLowerCase() &&
      existing.last_name?.toLowerCase() === lead.last_name?.toLowerCase() &&
      existing.email?.toLowerCase() === lead.email?.toLowerCase() &&
      existing.company_name?.toLowerCase() === lead.company_name?.toLowerCase()
    );

    if (existingDuplicate) return true;

    // Check for duplicates within the uploaded file
    const uploadedDuplicate = uploadedLeads.some((uploaded, index) => 
      uploadedLeads.findIndex(l => 
        l.first_name?.toLowerCase() === uploaded.first_name?.toLowerCase() &&
        l.last_name?.toLowerCase() === uploaded.last_name?.toLowerCase() &&
        l.email?.toLowerCase() === uploaded.email?.toLowerCase() &&
        l.company_name?.toLowerCase() === uploaded.company_name?.toLowerCase()
      ) !== index
    );

    return uploadedDuplicate;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      // Map Excel columns to database columns
      let mappedData = rawData.map((row: any) => ({
        first_name: row['First name'],
        last_name: row['Last name'],
        email: row['Email'],
        mobile_phone1: row['Mobile Phone1'],
        mobile_phone2: row['Mobile Phone2'],
        title: row['Title'],
        linkedin: row['Linkedin'],
        location: row['Location'],
        company_name: row['Company Name'],
        company_domain: row['Company Domain'],
        company_website: row['Company Website'],
        company_employee_count: parseInt(row['Company Employee Count']) || null,
        company_employee_count_range: row['Company Employee Count Range'],
        company_founded: parseInt(row['Company Founded']) || null,
        company_industry: row['Company Industry'],
        company_type: row['Company Type'],
        company_headquarters: row['Company Headquarters'],
        company_revenue_range: row['Company Revenue Range'],
        company_linkedin_url: row['Company Linkedin Url']
      }));

      // Get existing leads for duplicate checking
      const { data: existingLeads } = await supabase
        .from('leads')
        .select('first_name, last_name, email, company_name');

      // Filter out duplicates
      const initialCount = mappedData.length;
      mappedData = mappedData.filter(lead => !isDuplicate(lead, existingLeads || [], mappedData));
      const duplicatesCount = initialCount - mappedData.length;

      if (mappedData.length === 0) {
        setDuplicateNotification({
          show: true,
          count: duplicatesCount
        });
        return;
      }

      // Upload non-duplicate leads to Supabase
      const { error } = await supabase
        .from('leads')
        .insert(mappedData);

      if (error) {
        console.error('Error uploading leads:', error);
        return;
      }

      if (duplicatesCount > 0) {
        setDuplicateNotification({
          show: true,
          count: duplicatesCount
        });
      }

      fetchLeads();
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeleteLeads = async () => {
    const leadsToDelete = selectedLeads.length > 0 ? selectedLeads : leads.map(lead => lead.id);
    
    const { error } = await supabase
      .from('leads')
      .delete()
      .in('id', leadsToDelete);

    if (error) {
      console.error('Error deleting leads:', error);
      return;
    }

    setSelectedLeads([]);
    setShowDeleteConfirm(false);
    fetchLeads();
  };

  const filteredLeads = leads.filter(lead => {
    const searchMatch = (
      (lead.first_name || '') + ' ' + 
      (lead.last_name || '') + ' ' + 
      (lead.email || '')
    ).toLowerCase().includes(search.toLowerCase());
    
    const companyMatch = !companyFilter || 
      (lead.company_name || '').toLowerCase().includes(companyFilter.toLowerCase());
    
    const sizeMatch = !sizeFilter || 
      lead.company_employee_count?.toString() === sizeFilter;

    return searchMatch && companyMatch && sizeMatch;
  });

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    }
  };

  const handleAddToSequence = () => {
    navigate('/sequences', { state: { selectedLeads } });
  };

  const getStatusIcon = (status: string) => {
    const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || Clock;
    return <Icon className={`h-5 w-5 ${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}`} />;
  };

  const getProgressPercentage = (currentStep: number, totalSteps: number) => {
    return Math.round((currentStep / totalSteps) * 100);
  };

  const showLeadDetailsModal = (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadDetails(true);
  };

  const LeadDetailsModal = ({ lead, onClose }: { lead: Lead, onClose: () => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedLead, setEditedLead] = useState(lead);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleInterestStatusUpdate = async (leadId: string, status: 'green' | 'yellow' | 'red') => {
      try {
        const response = await fetch(`/api/v1/calls/lead/${leadId}/interest-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ interestStatus: status })
        });

        if (!response.ok) {
          throw new Error('Failed to update interest status');
        }

        // Update local state
        setEditedLead(prev => ({
          ...prev,
          call_status: {
            has_been_called: true,
            last_call: {
              ...prev.call_status?.last_call,
              interest_status: status,
              id: prev.call_status?.last_call?.id || '',
              status: prev.call_status?.last_call?.status || 'completed',
              timestamp: prev.call_status?.last_call?.timestamp || new Date().toISOString(),
              success: true
            }
          }
        }));

        // Close modal to refresh data
        onClose();
        window.location.reload();
      } catch (err: any) {
        console.error('Error updating interest status:', err);
        setError(err.message);
      }
    };

    const handleSave = async () => {
      try {
        setIsSaving(true);
        setError(null);
        
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            first_name: editedLead.first_name,
            last_name: editedLead.last_name,
            email: editedLead.email,
            company_name: editedLead.company_name,
            title: editedLead.title,
            mobile_phone1: editedLead.mobile_phone1,
            mobile_phone2: editedLead.mobile_phone2,
            company_employee_count: editedLead.company_employee_count,
            company_domain: editedLead.company_domain,
            company_website: editedLead.company_website,
            company_employee_count_range: editedLead.company_employee_count_range,
            company_founded: editedLead.company_founded,
            company_industry: editedLead.company_industry,
            company_type: editedLead.company_type,
            company_headquarters: editedLead.company_headquarters,
            company_revenue_range: editedLead.company_revenue_range,
            company_linkedin_url: editedLead.company_linkedin_url,
            linkedin: editedLead.linkedin,
            location: editedLead.location
          })
          .eq('id', lead.id);

        if (updateError) throw updateError;

        // Update the lead in the parent component
        onClose();
        window.location.reload(); // Refresh to get updated data
      } catch (err: any) {
        console.error('Error updating lead:', err);
        setError(err.message);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Lead Details</h2>
            <div className="flex space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.first_name || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, first_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.first_name || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.last_name || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, last_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.last_name || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editedLead.email || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, email: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.email || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.title || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, title: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.title || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_name || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_name || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Primary Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editedLead.mobile_phone1 || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, mobile_phone1: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.mobile_phone1 || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Secondary Phone</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={editedLead.mobile_phone2 || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, mobile_phone2: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.mobile_phone2 || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
              {isEditing ? (
                <input
                  type="url"
                  value={editedLead.linkedin || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, linkedin: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.linkedin || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.location || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, location: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.location || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Domain</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_domain || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_domain: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_domain || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Website</label>
              {isEditing ? (
                <input
                  type="url"
                  value={editedLead.company_website || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_website: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_website || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Size</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_employee_count_range || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_employee_count_range: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_employee_count_range || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Industry</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_industry || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_industry: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_industry || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Type</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_type || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_type: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_type || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Headquarters</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_headquarters || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_headquarters: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_headquarters || 'N/A'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Company Revenue Range</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLead.company_revenue_range || ''}
                  onChange={(e) => setEditedLead({ ...editedLead, company_revenue_range: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <p className="mt-1">{lead.company_revenue_range || 'N/A'}</p>
              )}
            </div>
          </div>

          {/* Call Status Section */}
          <div className="mt-6 border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Call Status</h3>
            {lead.call_status?.has_been_called ? (
              <div>
                <p className="text-sm text-gray-600">
                  Last Call: {new Date(lead.call_status.last_call?.timestamp || '').toLocaleString()}
                </p>
                {lead.call_status.last_call?.interest_status && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">Interest Level:</p>
                    <div className="flex space-x-2 mt-1">
                      <button
                        onClick={() => handleInterestStatusUpdate(lead.id, 'green')}
                        className={`px-3 py-1 rounded text-sm ${
                          lead.call_status.last_call.interest_status === 'green'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        Interested
                      </button>
                      <button
                        onClick={() => handleInterestStatusUpdate(lead.id, 'yellow')}
                        className={`px-3 py-1 rounded text-sm ${
                          lead.call_status.last_call.interest_status === 'yellow'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        Not Available
                      </button>
                      <button
                        onClick={() => handleInterestStatusUpdate(lead.id, 'red')}
                        className={`px-3 py-1 rounded text-sm ${
                          lead.call_status.last_call.interest_status === 'red'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        Not Interested
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-600">No calls made yet</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Confirm Deletion</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {selectedLeads.length > 0 ? selectedLeads.length : 'all'} leads? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLeads}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeadDetails && selectedLead && (
        <LeadDetailsModal 
          lead={selectedLead} 
          onClose={() => {
            setShowLeadDetails(false);
            setSelectedLead(null);
          }} 
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 className="h-5 w-5" />
            <span>{selectedLeads.length > 0 ? `Delete Selected (${selectedLeads.length})` : 'Delete All'}</span>
          </button>
          {selectedLeads.length > 0 && (
            <button
              onClick={handleAddToSequence}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <SendHorizontal className="h-5 w-5" />
              <span>Add to Sequence ({selectedLeads.length})</span>
            </button>
          )}
          <button
            onClick={() => navigate('/add-lead')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <User className="h-5 w-5" />
            <span>Add Lead</span>
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            <Upload className="h-5 w-5" />
            <span>Upload Leads</span>
            <input
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {duplicateNotification.show && (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 text-yellow-800 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>
            {duplicateNotification.count} duplicate {duplicateNotification.count === 1 ? 'lead was' : 'leads were'} found and omitted.
          </span>
          <button
            onClick={() => setDuplicateNotification({ show: false, count: 0 })}
            className="ml-auto text-sm hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search leads..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter by company"
            className="px-4 py-2 border rounded-lg"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          />
          <select
            className="px-4 py-2 border rounded-lg"
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
          >
            <option value="">All sizes</option>
            <option value="1-10">1-10</option>
            <option value="11-50">11-50</option>
            <option value="51-200">51-200</option>
            <option value="201-500">201-500</option>
            <option value="501+">501+</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedLeads.length === filteredLeads.length}
                  onChange={() => {
                    if (selectedLeads.length === filteredLeads.length) {
                      setSelectedLeads([]);
                    } else {
                      setSelectedLeads(filteredLeads.map(lead => lead.id));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Call Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLeads.map(lead => (
              <tr key={lead.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedLeads.includes(lead.id)}
                    onChange={() => toggleLeadSelection(lead.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lead.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{lead.company_name}</div>
                  <div className="text-sm text-gray-500">
                    {lead.company_employee_count && `${lead.company_employee_count} employees`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.title}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {lead.call_status?.has_been_called ? (
                      <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 text-green-500 mr-2" />
                            <span className="text-sm text-gray-900">
                              Called {new Date(lead.call_status.last_call?.timestamp || '').toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await fetch(`/api/v1/calls/lead/${lead.id}/mark-called`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    callDetails: {
                                      timestamp: new Date().toISOString(),
                                      notes: 'Manually marked as not called',
                                      success: false
                                    },
                                    reset: true
                                  })
                                });
                                // Update local state
                                setLeads(prevLeads => 
                                  prevLeads.map(l => 
                                    l.id === lead.id ? { 
                                      ...l, 
                                      call_status: { has_been_called: false } 
                                    } : l
                                  )
                                );
                              } catch (err) {
                                console.error('Error updating call status:', err);
                              }
                            }}
                            className="text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded ml-2"
                            title="Mark as not called"
                          >
                            Reset
                          </button>
                        </div>
                        
                        {/* Interest Status Indicator and Buttons */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="text-xs text-gray-600">Interest:</div>
                          <div className="flex gap-1">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetch(`/api/v1/calls/lead/${lead.id}/interest-status`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                      interestStatus: 'green'
                                    })
                                  });
                                  // Update local state
                                  setLeads(prevLeads => 
                                    prevLeads.map(l => {
                                      if (l.id === lead.id && l.call_status) {
                                        return { 
                                          ...l, 
                                          call_status: { 
                                            ...l.call_status,
                                            last_call: l.call_status.last_call ? {
                                              ...l.call_status.last_call,
                                              interest_status: 'green' as const
                                            } : undefined
                                          } 
                                        };
                                      }
                                      return l;
                                    })
                                  );
                                } catch (err) {
                                  console.error('Error updating interest status:', err);
                                }
                              }}
                              className={`w-6 h-6 rounded-full ${lead.call_status.last_call?.interest_status === 'green' 
                                ? 'bg-green-500 ring-2 ring-green-300' 
                                : 'bg-green-200 hover:bg-green-300'}`}
                              title="Interested"
                            />
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetch(`/api/v1/calls/lead/${lead.id}/interest-status`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                      interestStatus: 'yellow'
                                    })
                                  });
                                  // Update local state
                                  setLeads(prevLeads => 
                                    prevLeads.map(l => {
                                      if (l.id === lead.id && l.call_status) {
                                        return { 
                                          ...l, 
                                          call_status: { 
                                            ...l.call_status,
                                            last_call: l.call_status.last_call ? {
                                              ...l.call_status.last_call,
                                              interest_status: 'yellow' as const
                                            } : undefined
                                          } 
                                        };
                                      }
                                      return l;
                                    })
                                  );
                                } catch (err) {
                                  console.error('Error updating interest status:', err);
                                }
                              }}
                              className={`w-6 h-6 rounded-full ${lead.call_status.last_call?.interest_status === 'yellow' 
                                ? 'bg-yellow-500 ring-2 ring-yellow-300' 
                                : 'bg-yellow-200 hover:bg-yellow-300'}`}
                              title="Not available"
                            />
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetch(`/api/v1/calls/lead/${lead.id}/interest-status`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                      interestStatus: 'red'
                                    })
                                  });
                                  // Update local state
                                  setLeads(prevLeads => 
                                    prevLeads.map(l => {
                                      if (l.id === lead.id && l.call_status) {
                                        return { 
                                          ...l, 
                                          call_status: { 
                                            ...l.call_status,
                                            last_call: l.call_status.last_call ? {
                                              ...l.call_status.last_call,
                                              interest_status: 'red' as const
                                            } : undefined
                                          } 
                                        };
                                      }
                                      return l;
                                    })
                                  );
                                } catch (err) {
                                  console.error('Error updating interest status:', err);
                                }
                              }}
                              className={`w-6 h-6 rounded-full ${lead.call_status.last_call?.interest_status === 'red' 
                                ? 'bg-red-500 ring-2 ring-red-300' 
                                : 'bg-red-200 hover:bg-red-300'}`}
                              title="Not interested"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <Phone className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-500">Not called</span>
                        </div>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await fetch(`/api/v1/calls/lead/${lead.id}/mark-called`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  callDetails: {
                                    timestamp: new Date().toISOString(),
                                    notes: 'Manually marked as called',
                                    success: true
                                  }
                                })
                              });
                              // Update local state
                              setLeads(prevLeads => 
                                prevLeads.map(l => 
                                  l.id === lead.id ? { 
                                    ...l, 
                                    call_status: { 
                                      has_been_called: true,
                                      last_call: {
                                        id: 'manual',
                                        status: 'completed',
                                        timestamp: new Date().toISOString(),
                                        success: true
                                      }
                                    } 
                                  } : l
                                )
                              );
                            } catch (err) {
                              console.error('Error updating call status:', err);
                            }
                          }}
                          className="text-xs text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded ml-2"
                          title="Mark as called"
                        >
                          Mark Called
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showLeadDetailsModal(lead);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    title="View Details"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;