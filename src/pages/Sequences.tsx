import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, ArrowLeft, AlertCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CreateSequence from '../components/sequences/CreateSequence';
import EditSequence from '../components/sequences/EditSequence';
import SequenceList from '../components/sequences/SequenceList';
import { Sequence } from '../components/sequences/types';

const Sequences = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedLeads = location.state?.selectedLeads || [];
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [isAddingLeads, setIsAddingLeads] = useState(false);
  const [showNewSequence, setShowNewSequence] = useState(false);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<Sequence | null>(null);

  useEffect(() => {
    if (selectedLeads.length > 0) {
      setIsAddingLeads(true);
    }
  }, [selectedLeads]);

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    try {
      const { data: sequencesData, error: sequencesError } = await supabase
        .from('sequences')
        .select('*');

      if (sequencesError) {
        throw sequencesError;
      }

      const sequencesWithDetails = await Promise.all(
        (sequencesData || []).map(async (sequence) => {
          const { data: stepsData, error: stepsError } = await supabase
            .from('sequence_steps')
            .select('*')
            .eq('sequence_id', sequence.id)
            .order('step_order');

          if (stepsError) {
            throw stepsError;
          }

          const { data: leadSequencesData, error: leadSequencesError } = await supabase
            .from('lead_sequences')
            .select(`
              id,
              current_step,
              status,
              paused_at,
              lead_id,
              leads:leads (
                id,
                first_name,
                last_name,
                email,
                company_name,
                title
              )
            `)
            .eq('sequence_id', sequence.id);

          if (leadSequencesError) {
            throw leadSequencesError;
          }

          const leads = leadSequencesData?.map(ls => ({
            lead: ls.leads,
            current_step: ls.current_step || 0,
            status: ls.status || 'pending',
            paused_at: ls.paused_at
          })) || [];

          return {
            ...sequence,
            steps: stepsData || [],
            leads
          };
        })
      );

      setSequences(sequencesWithDetails);
      setError(null);
    } catch (err) {
      console.error('Error fetching sequences:', err);
      setError('Failed to load sequences. Please try again.');
    }
  };

  const calculateNextExecution = (step: any) => {
    const waitTime = step.configuration.wait_time || 1;
    const waitUnit = step.configuration.wait_time_unit || 'days';
    const nextExecution = new Date();
    
    switch (waitUnit) {
      case 'minutes':
        nextExecution.setMinutes(nextExecution.getMinutes() + waitTime);
        break;
      case 'hours':
        nextExecution.setHours(nextExecution.getHours() + waitTime);
        break;
      default: // days
        nextExecution.setDate(nextExecution.getDate() + waitTime);
    }

    return nextExecution.toISOString();
  };

  const createSequence = async (newSequence: { name: string; description: string; steps: any[] }) => {
    if (!newSequence.name.trim()) {
      setError('Please enter a sequence name');
      return;
    }

    if (newSequence.steps.length === 0) {
      setError('Please add at least one step to the sequence');
      return;
    }

    try {
      const { data: sequenceData, error: sequenceError } = await supabase
        .from('sequences')
        .insert([{
          name: newSequence.name,
          description: newSequence.description,
          enabled: true
        }])
        .select()
        .single();

      if (sequenceError || !sequenceData) {
        throw sequenceError;
      }

      const stepsToCreate = newSequence.steps.map((step, index) => ({
        sequence_id: sequenceData.id,
        step_type: step.step_type,
        step_order: index,
        configuration: step.configuration
      }));

      const { data: stepsData, error: stepsError } = await supabase
        .from('sequence_steps')
        .insert(stepsToCreate)
        .select();

      if (stepsError) {
        throw stepsError;
      }

      if (selectedLeads.length > 0) {
        const firstStep = stepsData[0];
        const nextExecution = calculateNextExecution(firstStep);

        const leadsToAdd = selectedLeads.map(leadId => ({
          lead_id: leadId,
          sequence_id: sequenceData.id,
          current_step: 0,
          status: 'pending',
          next_execution: nextExecution
        }));

        const { error: leadsError } = await supabase
          .from('lead_sequences')
          .insert(leadsToAdd);

        if (leadsError) {
          throw leadsError;
        }

        setIsAddingLeads(false);
        navigate('/');
      } else {
        setIsCreating(false);
        fetchSequences();
      }

      setError(null);
    } catch (err) {
      console.error('Error in sequence creation:', err);
      setError('Failed to create sequence. Please try again.');
    }
  };

  const updateSequence = async (updatedSequence: Sequence) => {
    try {
      const { error: sequenceError } = await supabase
        .from('sequences')
        .update({
          name: updatedSequence.name,
          description: updatedSequence.description,
          version: updatedSequence.version
        })
        .eq('id', updatedSequence.id);

      if (sequenceError) {
        throw sequenceError;
      }

      const { error: deleteError } = await supabase
        .from('sequence_steps')
        .delete()
        .eq('sequence_id', updatedSequence.id);

      if (deleteError) {
        throw deleteError;
      }

      const stepsToCreate = updatedSequence.steps.map((step, index) => ({
        sequence_id: updatedSequence.id,
        step_type: step.step_type,
        step_order: index,
        configuration: step.configuration
      }));

      const { error: stepsError } = await supabase
        .from('sequence_steps')
        .insert(stepsToCreate);

      if (stepsError) {
        throw stepsError;
      }

      setIsEditing(null);
      fetchSequences();
    } catch (err) {
      console.error('Error updating sequence:', err);
      setError('Failed to update sequence. Please try again.');
    }
  };

  const addLeadsToSequence = async () => {
    if (!selectedSequence) {
      setError('Please select a sequence');
      return;
    }

    try {
      const { data: steps, error: stepsError } = await supabase
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', selectedSequence)
        .order('step_order')
        .limit(1);

      if (stepsError) throw stepsError;
      if (!steps || steps.length === 0) throw new Error('No steps found in sequence');

      const firstStep = steps[0];
      const nextExecution = calculateNextExecution(firstStep);

      const leadsToAdd = selectedLeads.map(leadId => ({
        lead_id: leadId,
        sequence_id: selectedSequence,
        current_step: 0,
        status: 'pending',
        next_execution: nextExecution
      }));

      const { error } = await supabase
        .from('lead_sequences')
        .insert(leadsToAdd);

      if (error) {
        throw error;
      }

      setIsAddingLeads(false);
      navigate('/');
    } catch (err) {
      console.error('Error adding leads to sequence:', err);
      setError('Failed to add leads to sequence. Please try again.');
    }
  };

  const removeLead = async (sequenceId: string, leadId: string) => {
    try {
      const { error } = await supabase
        .from('lead_sequences')
        .delete()
        .eq('sequence_id', sequenceId)
        .eq('lead_id', leadId);

      if (error) {
        throw error;
      }

      fetchSequences();
    } catch (err) {
      console.error('Error removing lead from sequence:', err);
      setError('Failed to remove lead from sequence. Please try again.');
    }
  };

  const toggleSequenceEnabled = async (sequenceId: string, enabled: boolean) => {
    try {
      const { error: sequenceError } = await supabase
        .from('sequences')
        .update({ enabled })
        .eq('id', sequenceId);

      if (sequenceError) {
        throw sequenceError;
      }

      if (!enabled) {
        const { error: leadSequenceError } = await supabase
          .from('lead_sequences')
          .update({ 
            paused_at: new Date().toISOString(),
            status: 'pending'
          })
          .eq('sequence_id', sequenceId)
          .in('status', ['pending', 'in_progress']);

        if (leadSequenceError) {
          throw leadSequenceError;
        }
      }

      fetchSequences();
    } catch (err) {
      console.error('Error toggling sequence:', err);
      setError('Failed to update sequence. Please try again.');
    }
  };

  if (isAddingLeads) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold">Add Leads to Sequence</h1>
        </div>
        
        {!showNewSequence ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">
              Select a sequence to add {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''}
            </h2>
            <div className="space-y-4">
              {sequences.map((sequence) => (
                <label
                  key={sequence.id}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSequence === sequence.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="sequence"
                      value={sequence.id}
                      checked={selectedSequence === sequence.id}
                      onChange={(e) => setSelectedSequence(e.target.value)}
                      className="text-blue-600"
                    />
                    <div>
                      <h3 className="font-medium">{sequence.name}</h3>
                      <p className="text-sm text-gray-600">{sequence.description}</p>
                    </div>
                  </div>
                </label>
              ))}

              <button
                onClick={() => setShowNewSequence(true)}
                className="w-full p-4 border border-dashed rounded-lg text-center hover:bg-gray-50"
              >
                <Plus className="h-5 w-5 mx-auto mb-2 text-gray-400" />
                <span className="text-gray-600">Create New Sequence</span>
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAddingLeads(false);
                  navigate('/');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addLeadsToSequence}
                disabled={!selectedSequence}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Sequence
              </button>
            </div>
          </div>
        ) : (
          <CreateSequence
            onCancel={() => {
              setShowNewSequence(false);
            }}
            onSubmit={createSequence}
            isAddingLeads={true}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-sm hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sequences</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Create Sequence</span>
        </button>
      </div>

      {isCreating ? (
        <CreateSequence
          onCancel={() => setIsCreating(false)}
          onSubmit={createSequence}
        />
      ) : isEditing ? (
        <EditSequence
          sequence={isEditing}
          onCancel={() => setIsEditing(null)}
          onSubmit={updateSequence}
        />
      ) : (
        <SequenceList
          sequences={sequences}
          expandedSequence={expandedSequence}
          onToggleExpand={(id) => setExpandedSequence(expandedSequence === id ? null : id)}
          onRemoveLead={removeLead}
          onToggleEnabled={toggleSequenceEnabled}
          onEdit={setIsEditing}
        />
      )}
    </div>
  );
};

export default Sequences;