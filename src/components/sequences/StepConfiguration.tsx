import React from 'react';
import { GripVertical, Trash } from 'lucide-react';
import { SequenceStep, STEP_TYPES, WAIT_TIME_UNITS, DEFAULT_DECISION_PATHS } from './types';

interface StepConfigurationProps {
  steps: SequenceStep[];
  onStepsChange: (steps: SequenceStep[]) => void;
  showPlaceholders: boolean;
  onTogglePlaceholders: () => void;
  placeholderKeywords: Array<{ keyword: string; description: string }>;
}

const StepConfiguration: React.FC<StepConfigurationProps> = ({
  steps,
  onStepsChange,
  showPlaceholders,
  onTogglePlaceholders,
  placeholderKeywords
}) => {
  const addStep = (type: SequenceStep['step_type']) => {
    const newStep: SequenceStep = {
      id: Math.random().toString(),
      step_type: type,
      step_order: steps.length,
      configuration: {
        wait_time: 1,
        wait_time_unit: 'days',
        subject: '',
        message: '',
        notes: '',
        paths: DEFAULT_DECISION_PATHS.map(path => ({
          ...path,
          id: Math.random().toString(),
          next_step: steps.length + 1
        }))
      }
    };

    onStepsChange([...steps, newStep]);
  };

  const removeStep = (stepId: string) => {
    onStepsChange(steps.filter(step => step.id !== stepId));
  };

  const updateStepConfig = (stepId: string, config: Partial<SequenceStep['configuration']>) => {
    onStepsChange(
      steps.map(step =>
        step.id === stepId
          ? { ...step, configuration: { ...step.configuration, ...config } }
          : step
      )
    );
  };

  const updatePath = (stepId: string, pathId: string, updates: { label?: string; next_step?: number | null }) => {
    onStepsChange(
      steps.map(step =>
        step.id === stepId
          ? {
              ...step,
              configuration: {
                ...step.configuration,
                paths: (step.configuration.paths || []).map(path =>
                  path.id === pathId ? { ...path, ...updates } : path
                )
              }
            }
          : step
      )
    );
  };

  const getStepIcon = (type: string) => {
    const stepType = STEP_TYPES.find(t => t.value === type);
    const Icon = stepType?.icon || STEP_TYPES[0].icon;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div>
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="h-5 w-5 text-gray-400" />
                <div className="flex items-center gap-2">
                  {getStepIcon(step.step_type)}
                  <span className="font-medium">
                    Step {index + 1}: {STEP_TYPES.find(t => t.value === step.step_type)?.label}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeStep(step.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Wait Time
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={step.configuration.wait_time || 0}
                    onChange={(e) => updateStepConfig(step.id, { wait_time: parseInt(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Time Unit
                  </label>
                  <select
                    value={step.configuration.wait_time_unit || 'days'}
                    onChange={(e) => updateStepConfig(step.id, { wait_time_unit: e.target.value as 'minutes' | 'hours' | 'days' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {WAIT_TIME_UNITS.map(unit => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {step.step_type === 'email' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subject</label>
                    <div className="mt-1 relative">
                      <input
                        type="text"
                        value={step.configuration.subject || ''}
                        onChange={(e) => updateStepConfig(step.id, { subject: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Email subject"
                      />
                      <button
                        type="button"
                        onClick={onTogglePlaceholders}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {'{...}'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Message Template</label>
                    <div className="mt-1 relative">
                      <textarea
                        value={step.configuration.message || ''}
                        onChange={(e) => updateStepConfig(step.id, { message: e.target.value })}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        rows={4}
                        placeholder="Write your email template..."
                      />
                      <button
                        type="button"
                        onClick={onTogglePlaceholders}
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      >
                        {'{...}'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {(step.step_type === 'call' || step.step_type === 'linkedin_request') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <div className="mt-1 relative">
                    <textarea
                      value={step.configuration.notes || ''}
                      onChange={(e) => updateStepConfig(step.id, { notes: e.target.value })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows={3}
                      placeholder="Action notes or script..."
                    />
                    <button
                      type="button"
                      onClick={onTogglePlaceholders}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                    >
                      {'{...}'}
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Decision Paths</h4>
                <div className="space-y-3">
                  {(step.configuration.paths || []).map((path) => (
                    <div key={path.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <select
                          value={path.label}
                          onChange={(e) => updatePath(step.id, path.id, { label: e.target.value })}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          {['Replied', 'No Reply'].map(label => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={path.next_step === null}
                            onChange={(e) => updatePath(step.id, path.id, { 
                              next_step: e.target.checked ? null : 0 
                            })}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">End</span>
                        </label>
                        {path.next_step !== null && (
                          <select
                            value={path.next_step}
                            onChange={(e) => updatePath(step.id, path.id, { 
                              next_step: parseInt(e.target.value)
                            })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            {Array.from({ length: steps.length }, (_, i) => (
                              <option key={i} value={i}>
                                Step {i + 1}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STEP_TYPES.map((type) => (
          <button
            key={type.value}
            onClick={() => addStep(type.value as SequenceStep['step_type'])}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <type.icon className="h-5 w-5" />
            <span>Add {type.label}</span>
          </button>
        ))}
      </div>

      {showPlaceholders && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Available Placeholders</h3>
            <div className="space-y-2">
              {placeholderKeywords.map(({ keyword, description }) => (
                <button
                  key={keyword}
                  onClick={() => {
                    onTogglePlaceholders();
                  }}
                  className="w-full text-left p-2 hover:bg-gray-50 rounded flex justify-between items-center"
                >
                  <code className="text-blue-600">{keyword}</code>
                  <span className="text-gray-500 text-sm">{description}</span>
                </button>
              ))}
            </div>
            <button
              onClick={onTogglePlaceholders}
              className="mt-4 w-full px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepConfiguration;