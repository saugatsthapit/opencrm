import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Linkedin } from 'lucide-react';
import { linkedInService } from '../lib/linkedin';

const LinkedInSettings = () => {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkLinkedInConfiguration();
  }, []);

  const checkLinkedInConfiguration = async () => {
    try {
      const isValid = await linkedInService.verifyConnection();
      setIsConfigured(isValid);
    } catch (err) {
      setError('Failed to verify LinkedIn configuration');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 h-10 w-10"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Linkedin className="h-6 w-6 text-blue-600" />
          <h2 className="text-lg font-semibold">LinkedIn Configuration</h2>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          <span className={isConfigured ? 'text-green-600' : 'text-red-600'}>
            {isConfigured ? 'Connected' : 'Not Connected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4">
        <p className="text-gray-600">
          LinkedIn API is {isConfigured ? 'properly configured' : 'not configured'}. 
          {!isConfigured && ' Please check your environment variables for LinkedIn API settings.'}
        </p>
      </div>
    </div>
  );
}

export default LinkedInSettings;