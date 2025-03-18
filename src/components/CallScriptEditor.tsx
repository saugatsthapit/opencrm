import React, { useState } from 'react';
import { Trash2, PlusCircle, Phone } from 'lucide-react';

// Available AI voices for VAPI
const VOICE_OPTIONS = [
  { value: 'shimmer', label: 'Shimmer (Female)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (Male)' },
  { value: 'onyx', label: 'Onyx (Male)' },
];

// Available AI models
const AI_MODEL_OPTIONS = [
  { value: 'gpt-4', label: 'GPT-4 (Recommended)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Faster)' },
];

type CallScriptEditorProps = {
  value: any;
  onChange: (value: any) => void;
  onTestCall?: (phoneNumber: string) => void;
};

export default function CallScriptEditor({ value, onChange, onTestCall }: CallScriptEditorProps) {
  const [testPhone, setTestPhone] = useState('');
  
  const handleChange = (field: string, newValue: any) => {
    onChange({
      ...value,
      [field]: newValue
    });
  };
  
  const handleTalkingPointChange = (index: number, newValue: string) => {
    const newTalkingPoints = [...(value.talking_points || [])];
    newTalkingPoints[index] = newValue;
    handleChange('talking_points', newTalkingPoints);
  };
  
  const handleQuestionChange = (index: number, newValue: string) => {
    const newQuestions = [...(value.questions || [])];
    newQuestions[index] = newValue;
    handleChange('questions', newQuestions);
  };
  
  const addTalkingPoint = () => {
    handleChange('talking_points', [...(value.talking_points || []), '']);
  };
  
  const removeTalkingPoint = (index: number) => {
    const newTalkingPoints = [...(value.talking_points || [])];
    newTalkingPoints.splice(index, 1);
    handleChange('talking_points', newTalkingPoints);
  };
  
  const addQuestion = () => {
    handleChange('questions', [...(value.questions || []), '']);
  };
  
  const removeQuestion = (index: number) => {
    const newQuestions = [...(value.questions || [])];
    newQuestions.splice(index, 1);
    handleChange('questions', newQuestions);
  };
  
  const handleTestCall = () => {
    if (onTestCall && testPhone) {
      onTestCall(testPhone);
    }
  };
  
  return (
    <div className="space-y-6 p-4 bg-white rounded-lg shadow">
      <div>
        <h3 className="text-lg font-medium mb-4">Call Script Settings</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Voice</label>
            <select
              className="w-full rounded-md border-gray-300"
              value={value.voice || 'shimmer'}
              onChange={(e) => handleChange('voice', e.target.value)}
            >
              {VOICE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              VAPI voice for the AI conversation.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">AI Model</label>
            <select
              className="w-full rounded-md border-gray-300"
              value={value.ai_model || 'gpt-4'}
              onChange={(e) => handleChange('ai_model', e.target.value)}
            >
              {AI_MODEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              AI model used for the conversation.
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Caller Phone Number</label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300"
            placeholder="e.g. +12125551234"
            value={value.caller_phone_number || ''}
            onChange={(e) => handleChange('caller_phone_number', e.target.value)}
            disabled
          />
          <p className="text-xs text-gray-500 mt-1">
            Calls will be made from your configured Twilio number.
          </p>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-lg font-medium mb-4">Call Script Content</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">First Greeting</label>
          <input
            type="text"
            className="w-full rounded-md border-gray-300"
            placeholder="Hello, this is [Name] from [Company]..."
            value={value.greeting || ''}
            onChange={(e) => handleChange('greeting', e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            This is the first thing the AI will say when the call is answered.
          </p>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Introduction</label>
          <textarea
            className="w-full rounded-md border-gray-300"
            rows={3}
            placeholder="I'm calling about..."
            value={value.introduction || ''}
            onChange={(e) => handleChange('introduction', e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">Talking Points</label>
            <button
              type="button"
              className="inline-flex items-center text-blue-600 text-sm"
              onClick={addTalkingPoint}
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Add Point
            </button>
          </div>
          
          {(value.talking_points || []).length === 0 && (
            <p className="text-sm text-gray-500 italic mb-2">
              No talking points added yet. Click "Add Point" to create one.
            </p>
          )}
          
          {(value.talking_points || []).map((point: string, index: number) => (
            <div key={index} className="flex mb-2">
              <textarea
                className="flex-grow rounded-md border-gray-300"
                rows={2}
                placeholder={`Talking point ${index + 1}`}
                value={point}
                onChange={(e) => handleTalkingPointChange(index, e.target.value)}
              />
              <button
                type="button"
                className="ml-2 text-red-500"
                onClick={() => removeTalkingPoint(index)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium">Questions to Ask</label>
            <button
              type="button"
              className="inline-flex items-center text-blue-600 text-sm"
              onClick={addQuestion}
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Add Question
            </button>
          </div>
          
          {(value.questions || []).length === 0 && (
            <p className="text-sm text-gray-500 italic mb-2">
              No questions added yet. Click "Add Question" to create one.
            </p>
          )}
          
          {(value.questions || []).map((question: string, index: number) => (
            <div key={index} className="flex mb-2">
              <textarea
                className="flex-grow rounded-md border-gray-300"
                rows={2}
                placeholder={`Question ${index + 1}`}
                value={question}
                onChange={(e) => handleQuestionChange(index, e.target.value)}
              />
              <button
                type="button"
                className="ml-2 text-red-500"
                onClick={() => removeQuestion(index)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Closing Message</label>
          <textarea
            className="w-full rounded-md border-gray-300"
            rows={3}
            placeholder="Thank you for your time..."
            value={value.closing || ''}
            onChange={(e) => handleChange('closing', e.target.value)}
          />
        </div>
      </div>
      
      {onTestCall && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-lg font-medium mb-4">Test Your Call Script</h3>
          
          <div className="flex items-center">
            <input
              type="tel"
              className="flex-grow rounded-md border-gray-300"
              placeholder="Enter phone number to test"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            
            <button
              type="button"
              className="ml-2 bg-blue-600 text-white rounded-md px-4 py-2 flex items-center"
              disabled={!testPhone}
              onClick={handleTestCall}
            >
              <Phone className="w-4 h-4 mr-2" />
              Test Call
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This will place a real call using your script. Standard calling rates apply.
          </p>
        </div>
      )}
    </div>
  );
} 