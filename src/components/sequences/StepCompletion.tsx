import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface StepCompletionProps {
  leadSequenceId: string;
  stepId: string;
  isCompleted: boolean;
  notes?: string;
  onComplete: () => void;
}

const StepCompletion: React.FC<StepCompletionProps> = ({
  leadSequenceId,
  stepId,
  isCompleted,
  notes: initialNotes = '',
  onComplete
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (!isCompleted) {
        const { error } = await supabase
          .from('step_completions')
          .insert({
            lead_sequence_id: leadSequenceId,
            step_id: stepId,
            notes: notes.trim(),
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('step_completions')
          .delete()
          .match({ lead_sequence_id: leadSequenceId, step_id: stepId });

        if (error) throw error;
      }

      onComplete();
    } catch (err) {
      console.error('Error updating step completion:', err);
    } finally {
      setLoading(false);
      setIsEditing(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Manual Step Completion</span>
        <button
          onClick={() => isCompleted ? handleComplete() : setIsEditing(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium ${
            isCompleted
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          disabled={loading}
        >
          {isCompleted ? (
            <>
              <Check className="h-4 w-4" />
              <span>Completed</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              <span>Mark as Complete</span>
            </>
          )}
        </button>
      </div>

      {isEditing && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this interaction..."
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            rows={3}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1 px-3 py-1.5 border rounded text-sm font-medium hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              <span>{loading ? 'Saving...' : 'Complete'}</span>
            </button>
          </div>
        </div>
      )}

      {isCompleted && notes && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </div>
  );
};

export default StepCompletion;