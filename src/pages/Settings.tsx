import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Mail, Linkedin, Send } from 'lucide-react';
import { emailService } from '../lib/email';
import { linkedInService } from '../lib/linkedin';

const Settings = () => {
  const [emailConfig, setEmailConfig] = useState({
    host: import.meta.env.VITE_EMAIL_HOST || '',
    port: import.meta.env.VITE_EMAIL_PORT || '587',
    secure: import.meta.env.VITE_EMAIL_SECURE === 'true',
    user: import.meta.env.VITE_EMAIL_USER || '',
    password: import.meta.env.VITE_EMAIL_PASSWORD || '',
  });

  const [linkedInConfig, setLinkedInConfig] = useState({
    accessToken: import.meta.env.VITE_LINKEDIN_ACCESS_TOKEN || '',
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Test email form state
  const [testEmail, setTestEmail] = useState({
    to: '',
    subject: 'Test Email from CRM',
    message: 'This is a test email from your CRM system.',
  });
  const [sendingTest, setSendingTest] = useState(false);

  const sendTestEmail = async () => {
    if (!testEmail.to) {
      setError('Please enter a recipient email address');
      return;
    }

    setSendingTest(true);
    setError(null);
    setSuccess(null);

    try {
      await emailService.sendTestEmail(
        testEmail.to,
        testEmail.subject,
        testEmail.message
      );

      setSuccess('Test email sent successfully!');
      setTestEmail({
        to: '',
        subject: 'Test Email from CRM',
        message: 'This is a test email from your CRM system.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Integration Settings</h1>

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

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
          <CheckCircle className="h-5 w-5" />
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-sm hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-8">
        {/* Email Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold">Email Configuration</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">SMTP Host</label>
                  <input
                    type="text"
                    value={emailConfig.host}
                    onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
                    placeholder="smtp.example.com"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">SMTP Port</label>
                  <input
                    type="text"
                    value={emailConfig.port}
                    onChange={(e) => setEmailConfig({ ...emailConfig, port: e.target.value })}
                    placeholder="587"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  value={emailConfig.user}
                  onChange={(e) => setEmailConfig({ ...emailConfig, user: e.target.value })}
                  placeholder="your@email.com"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  value={emailConfig.password}
                  onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="secure"
                  checked={emailConfig.secure}
                  onChange={(e) => setEmailConfig({ ...emailConfig, secure: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="secure" className="text-sm text-gray-700">
                  Use SSL/TLS
                </label>
              </div>
            </div>

            {/* Test Email Form */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Send Test Email</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">To</label>
                  <input
                    type="email"
                    value={testEmail.to}
                    onChange={(e) => setTestEmail({ ...testEmail, to: e.target.value })}
                    placeholder="recipient@example.com"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input
                    type="text"
                    value={testEmail.subject}
                    onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Message</label>
                  <textarea
                    value={testEmail.message}
                    onChange={(e) => setTestEmail({ ...testEmail, message: e.target.value })}
                    rows={4}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={sendTestEmail}
                  disabled={sendingTest}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {sendingTest ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* LinkedIn Settings */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Linkedin className="h-6 w-6 text-blue-600" />
              <h2 className="text-lg font-semibold">LinkedIn Configuration</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Access Token</label>
              <input
                type="password"
                value={linkedInConfig.accessToken}
                onChange={(e) => setLinkedInConfig({ ...linkedInConfig, accessToken: e.target.value })}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                You can get your LinkedIn access token from the LinkedIn Developer Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;