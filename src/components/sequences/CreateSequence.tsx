import React, { useState } from 'react';
import { SequenceStep, PLACEHOLDER_KEYWORDS } from './types';
import StepConfiguration from './StepConfiguration';

interface CreateSequenceProps {
  onCancel: () => void;
  onSubmit: (sequence: { name: string; description: string; steps: SequenceStep[] }) => void;
  isAddingLeads?: boolean;
}

const CreateSequence: React.FC<CreateSequenceProps> = ({ onCancel, onSubmit, isAddingLeads }) => {
  const [sequence, setSequence] = useState({
    name: '',
    description: '',
    steps: [] as SequenceStep[],
  });
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Create New Sequence</h2>
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
            onClick={() => onSubmit(sequence)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Sequence
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSequence;