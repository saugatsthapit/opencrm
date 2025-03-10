import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, Search, Filter, SendHorizontal, AlertCircle, Trash2, AlertTriangle, Clock, CheckCircle, XCircle, Mail } from 'lucide-react';
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
  sequences?: {
    id: string;
    name: string;
    current_step: number;
    total_steps: number;
    status: string;
  }[];
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
      sequences: lead.lead_sequences?.map(ls => ({
        id: ls.sequence.id,
        name: ls.sequence.name,
        current_step: ls.current_step || 0,
        total_steps: ls.sequence.sequence_steps.length,
        status: ls.status || 'pending'
      }))
    }));

    setLeads(transformedLeads);
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

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedLeads.length === filteredLeads.length}
              onChange={toggleSelectAll}
              className="rounded text-blue-600"
            />
            <span>Select All</span>
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredLeads.map(lead => (
            <div
              key={lead.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">
                    {lead.first_name} {lead.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">{lead.title}</p>
                  <p className="text-sm text-gray-600">{lead.email}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedLeads.includes(lead.id)}
                  onChange={() => toggleLeadSelection(lead.id)}
                  className="mt-1 rounded text-blue-600"
                />
              </div>
              <div className="mt-2 pt-2 border-t">
                <p className="text-sm font-medium">{lead.company_name}</p>
                <p className="text-sm text-gray-600">
                  {lead.company_employee_count} employees
                </p>
              </div>
              {lead.sequences && lead.sequences.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Active Sequences</h4>
                  <div className="space-y-2">
                    {lead.sequences.map(sequence => (
                      <div key={sequence.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{sequence.name}</span>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(sequence.status)}
                            <span className="text-sm capitalize">
                              {sequence.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{
                                width: `${getProgressPercentage(sequence.current_step + 1, sequence.total_steps)}%`
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            Step {sequence.current_step + 1} of {sequence.total_steps}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;