import React from 'react';
import { Mail, Phone, Linkedin, Clock } from 'lucide-react';
import { SequenceStep } from './types';
import StepCompletion from './StepCompletion';
import EmailTracking from './EmailTracking';

interface SequenceWorkflowProps {
  steps: SequenceStep[];
  currentStep?: number;
  leadSequenceId?: string;
  completions?: Record<string, { completed_at: string; notes: string }>;
  onStepComplete?: () => void;
}

const SequenceWorkflow: React.FC<SequenceWorkflowProps> = ({
  steps,
  currentStep,
  leadSequenceId,
  completions = {},
  onStepComplete
}) => {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-6 w-6" />;
      case 'call':
        return <Phone className="h-6 w-6" />;
      case 'linkedin_request':
        return <Linkedin className="h-6 w-6" />;
      default:
        return null;
    }
  };

  const getStepTitle = (type: string) => {
    switch (type) {
      case 'email':
        return 'Send Email';
      case 'call':
        return 'Phone Call';
      case 'linkedin_request':
        return 'LinkedIn Connection';
      default:
        return 'Unknown Step';
    }
  };

  const formatWaitTime = (time: number | undefined, unit: string | undefined) => {
    if (!time) return '';
    const unitLabel = unit === 'minutes' ? 'minute' : unit === 'hours' ? 'hour' : 'day';
    return `Wait ${time} ${unitLabel}${time !== 1 ? 's' : ''}`;
  };

  return (
    <div className="mt-6 border-t pt-6">
      <h4 className="text-sm font-medium text-gray-700 mb-4">Workflow Steps</h4>
      <div className="relative">
        <div className="absolute top-0 bottom-0 left-6 w-px bg-gray-200" />
        <div className="space-y-8">
          {steps.map((step, index) => {
            const isManualStep = step.step_type === 'call' || step.step_type === 'linkedin_request';
            const completion = completions[step.id];
            
            return (
              <div
                key={step.id}
                className={`relative flex items-start gap-4 ${
                  currentStep === index ? 'opacity-100' : 'opacity-60'
                }`}
              >
                <div className={`relative z-10 rounded-full p-2 ${
                  currentStep === index
                    ? 'bg-blue-100 text-blue-600'
                    : completion
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-500'
                }`}>
                  {getStepIcon(step.step_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      Step {index + 1}: {getStepTitle(step.step_type)}
                    </h4>
                    {step.configuration.wait_time && step.configuration.wait_time > 0 && (
                      <span className="flex items-center gap-1 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        {formatWaitTime(step.configuration.wait_time, step.configuration.wait_time_unit)}
                      </span>
                    )}
                  </div>

                  {step.step_type === 'email' && (
                    <>
                      <div className="mt-2 space-y-2">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Subject:</span>{' '}
                          {step.configuration.subject}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Message:</span>
                          <div className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3">
                            {step.configuration.message}
                          </div>
                        </div>
                      </div>
                      {leadSequenceId && (
                        <div className="mt-4">
                          <EmailTracking
                            leadSequenceId={leadSequenceId}
                            stepId={step.id}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {(step.step_type === 'call' || step.step_type === 'linkedin_request') && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Notes:</span>
                        <div className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3">
                          {step.configuration.notes}
                        </div>
                      </div>
                    </div>
                  )}

                  {isManualStep && leadSequenceId && (
                    <StepCompletion
                      leadSequenceId={leadSequenceId}
                      stepId={step.id}
                      isCompleted={!!completion}
                      notes={completion?.notes}
                      onComplete={onStepComplete}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SequenceWorkflow;