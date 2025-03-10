import React from 'react';
import { ChevronDown, ChevronUp, Users, X, Power, Edit2 } from 'lucide-react';
import { Sequence, STEP_TYPES, STATUS_ICONS, STATUS_COLORS } from './types';
import SequenceWorkflow from './SequenceWorkflow';

interface SequenceListProps {
  sequences: Sequence[];
  expandedSequence: string | null;
  onToggleExpand: (id: string) => void;
  onRemoveLead: (sequenceId: string, leadId: string) => void;
  onToggleEnabled: (sequenceId: string, enabled: boolean) => void;
  onEdit: (sequence: Sequence) => void;
}

const SequenceList: React.FC<SequenceListProps> = ({
  sequences,
  expandedSequence,
  onToggleExpand,
  onRemoveLead,
  onToggleEnabled,
  onEdit
}) => {
  const getStatusIcon = (status: string) => {
    const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] || STATUS_ICONS.pending;
    return <Icon className={`h-5 w-5 ${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}`} />;
  };

  const getProgressPercentage = (currentStep: number, totalSteps: number) => {
    return Math.round((currentStep / totalSteps) * 100);
  };

  const getStepIcon = (type: string) => {
    const stepType = STEP_TYPES.find(t => t.value === type);
    const Icon = stepType?.icon || STEP_TYPES[0].icon;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {sequences.map((sequence) => (
        <div key={sequence.id} className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{sequence.name}</h3>
                  <p className="text-gray-600 mt-1">{sequence.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onEdit(sequence)}
                    className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200"
                    title="Edit sequence"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => onToggleEnabled(sequence.id, !sequence.enabled)}
                    className={`p-2 rounded-full transition-colors ${
                      sequence.enabled 
                        ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                    title={sequence.enabled ? 'Disable sequence' : 'Enable sequence'}
                  >
                    <Power className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => onToggleExpand(sequence.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                {expandedSequence === sequence.id ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="h-5 w-5" />
                <span>{sequence.leads?.length || 0} leads</span>
              </div>
              <div className="flex items-center gap-2">
                {sequence.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-1 text-sm text-gray-500">
                    {idx > 0 && <span>→</span>}
                    {getStepIcon(step.step_type)}
                  </div>
                ))}
              </div>
              {!sequence.enabled && (
                <span className="text-sm text-red-600 font-medium">Disabled</span>
              )}
            </div>

            {expandedSequence === sequence.id && (
              <>
                <SequenceWorkflow steps={sequence.steps} />
                
                {sequence.leads && sequence.leads.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Leads in Sequence</h4>
                    <div className="grid gap-3">
                      {sequence.leads.map((leadSequence) => (
                        <div key={leadSequence.lead.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">
                              {leadSequence.lead.first_name} {leadSequence.lead.last_name}
                            </div>
                            <div className="text-sm text-gray-600">
                              {leadSequence.lead.title} at {leadSequence.lead.company_name}
                            </div>
                            <div className="text-sm text-gray-500">{leadSequence.lead.email}</div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(leadSequence.status)}
                                <span className="font-medium capitalize">
                                  {leadSequence.status.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Step {leadSequence.current_step + 1} of {sequence.steps.length}
                              </div>
                              {leadSequence.paused_at && (
                                <div className="text-sm text-red-600">
                                  Paused on {new Date(leadSequence.paused_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="w-24">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{
                                    width: `${getProgressPercentage(leadSequence.current_step + 1, sequence.steps.length)}%`
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              onClick={() => onRemoveLead(sequence.id, leadSequence.lead.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SequenceList;