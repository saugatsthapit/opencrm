import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { DecisionPath, DECISION_PATH_LABELS } from './types';

interface DecisionStepProps {
  leadSequenceId: string;
  stepId: string;
  paths: DecisionPath[];
  selectedPath?: string;
  onDecisionMade: (pathId: string) => void;
}

const DecisionStep: React.FC<DecisionStepProps> = ({
  leadSequenceId,
  stepId,
  paths,
  selectedPath,
  onDecisionMade
}) => {
  const [loading, setLoading] = useState(false);

  const handleDecision = async (pathId: string) => {
    setLoading(true);
    try {
      await onDecisionMade(pathId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="text-sm font-medium text-gray-700">Choose Path</div>
      <div className="grid gap-3">
        {paths.map((path) => (
          <button
            key={path.id}
            onClick={() => handleDecision(path.id)}
            disabled={loading || !!selectedPath}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              selectedPath === path.id
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'hover:bg-gray-50 border-gray-200'
            }`}
          >
            <span className="font-medium">{path.label}</span>
            {selectedPath === path.id && (
              <Check className="h-5 w-5 text-blue-600" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export interface DecisionStepConfigProps {
  paths: DecisionPath[];
  onChange: (paths: DecisionPath[]) => void;
  totalSteps: number;
}

export const DecisionStepConfig: React.FC<DecisionStepConfigProps> = ({
  paths,
  onChange,
  totalSteps
}) => {
  const updatePath = (pathId: string, updates: Partial<DecisionPath>) => {
    onChange(
      paths.map(path =>
        path.id === pathId ? { ...path, ...updates } : path
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-gray-700 mb-2">Decision Path</div>
      <div className="space-y-3">
        {paths.map((path) => (
          <div key={path.id} className="flex items-center gap-3">
            <div className="flex-1">
              <select
                value={path.label}
                onChange={(e) => updatePath(path.id, { 
                  label: e.target.value as DecisionPath['label'],
                  next_step: path.next_step
                })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {DECISION_PATH_LABELS.map(label => (
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
                  onChange={(e) => updatePath(path.id, { 
                    next_step: e.target.checked ? null : 0 
                  })}
                  className="form-checkbox h-4 w-4"
                />
                <span className="text-sm text-gray-700">End</span>
              </label>
              {path.next_step !== null && (
                <select
                  value={path.next_step}
                  onChange={(e) => updatePath(path.id, { 
                    next_step: parseInt(e.target.value)
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {Array.from({ length: totalSteps }, (_, i) => (
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
  );
};

export default DecisionStep;