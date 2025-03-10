import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { SequenceStep, STEP_TYPES, PLACEHOLDER_KEYWORDS } from './types';
import StepConfiguration from './StepConfiguration';

interface EditSequenceProps {
  sequence: {
    id: string;
    name: string;
    description: string;
    steps: SequenceStep[];
    version: number;
  };
  onCancel: () => void;
  onSubmit: (sequence: { 
    id: string;
    name: string;
    description: string;
    steps: SequenceStep[];
    version: number;
  }) => void;
}

const EditSequence: React.FC<EditSequenceProps> = ({ sequence: initialSequence, onCancel, onSubmit }) => {
  const [sequence, setSequence] = useState(initialSequence);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

  const handleSubmit = () => {
    onSubmit({
      ...sequence,
      version: sequence.version + 1
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Edit Sequence</h2>

      {showWarning && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-yellow-800">Important: Version Control</h4>
            <div className="mt-1 text-sm text-yellow-700">
              Changes to this sequence will only affect:
              <div className="ml-4 mt-2">
                <div>• New leads added to the sequence</div>
                <div>• Steps that haven't been executed yet for existing leads</div>
              </div>
            </div>
            <button 
              onClick={() => setShowWarning(false)}
              className="mt-2 text-sm text-yellow-800 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={sequence.name}
            onChange={(e) => setSequence({ ...sequence, name: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Sequence name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={sequence.description}
            onChange={(e) => setSequence({ ...sequence, description: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={2}
            placeholder="Sequence description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Steps</label>
          <StepConfiguration
            steps={sequence.steps}
            onStepsChange={(steps) => setSequence({ ...sequence, steps })}
            showPlaceholders={showPlaceholders}
            onTogglePlaceholders={() => setShowPlaceholders(!showPlaceholders)}
            placeholderKeywords={PLACEHOLDER_KEYWORDS}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSequence;