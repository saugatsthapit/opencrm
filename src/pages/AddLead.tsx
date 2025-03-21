import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Save, X, ArrowLeft } from 'lucide-react';

export default function AddLead() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    mobile_phone1: '',
    mobile_phone2: '',
    title: '',
    company_name: '',
    company_domain: '',
    company_website: '',
    company_employee_count: '',
    company_employee_count_range: '',
    company_founded: '',
    company_industry: '',
    company_type: '',
    company_headquarters: '',
    company_revenue_range: '',
    company_linkedin_url: '',
    linkedin: '',
    location: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Format data for submission
      const leadData = {
        ...formData,
        company_employee_count: formData.company_employee_count ? parseInt(formData.company_employee_count) : null,
        company_founded: formData.company_founded ? parseInt(formData.company_founded) : null
      };

      // Submit to Supabase
      const { data, error } = await supabase
        .from('leads')
        .insert(leadData);

      if (error) throw error;

      setSuccess(true);
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        mobile_phone1: '',
        mobile_phone2: '',
        title: '',
        company_name: '',
        company_domain: '',
        company_website: '',
        company_employee_count: '',
        company_employee_count_range: '',
        company_founded: '',
        company_industry: '',
        company_type: '',
        company_headquarters: '',
        company_revenue_range: '',
        company_linkedin_url: '',
        linkedin: '',
        location: ''
      });

      // Navigate back to dashboard after short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      console.error('Error adding lead:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate('/')}
          className="mr-4 p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-semibold">Add New Lead</h1>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <div className="flex">
            <div className="py-1">
              <X className="h-5 w-5 text-red-500 mr-3" />
            </div>
            <div>
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
          <div className="flex">
            <div className="py-1">
              <Save className="h-5 w-5 text-green-500 mr-3" />
            </div>
            <div>
              <p className="font-bold">Success</p>
              <p>Lead added successfully! Redirecting to dashboard...</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <h2 className="text-xl font-medium border-b pb-2">Contact Information</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name*
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name*
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email*
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Phone 1*
                </label>
                <input
                  type="tel"
                  name="mobile_phone1"
                  value={formData.mobile_phone1}
                  onChange={handleChange}
                  required
                  placeholder="+1 (123) 456-7890"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Phone 2
                </label>
                <input
                  type="tel"
                  name="mobile_phone2"
                  value={formData.mobile_phone2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn Profile
              </label>
              <input
                type="url"
                name="linkedin"
                value={formData.linkedin}
                onChange={handleChange}
                placeholder="https://www.linkedin.com/in/username"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="City, State, Country"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-medium border-b pb-2">Company Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name*
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Domain
                </label>
                <input
                  type="text"
                  name="company_domain"
                  value={formData.company_domain}
                  onChange={handleChange}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Website
                </label>
                <input
                  type="url"
                  name="company_website"
                  value={formData.company_website}
                  onChange={handleChange}
                  placeholder="https://www.example.com"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Count
                </label>
                <input
                  type="number"
                  name="company_employee_count"
                  value={formData.company_employee_count}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Employee Count Range
                </label>
                <select
                  name="company_employee_count_range"
                  value={formData.company_employee_count_range}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select a range</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="501-1000">501-1000</option>
                  <option value="1001-5000">1001-5000</option>
                  <option value="5001-10000">5001-10000</option>
                  <option value="10001+">10001+</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year Founded
                </label>
                <input
                  type="number"
                  name="company_founded"
                  value={formData.company_founded}
                  onChange={handleChange}
                  placeholder="2020"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  name="company_industry"
                  value={formData.company_industry}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Type
              </label>
              <input
                type="text"
                name="company_type"
                value={formData.company_type}
                onChange={handleChange}
                placeholder="Public, Private, Non-profit, etc."
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Headquarters
              </label>
              <input
                type="text"
                name="company_headquarters"
                value={formData.company_headquarters}
                onChange={handleChange}
                placeholder="City, State, Country"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Revenue Range
              </label>
              <input
                type="text"
                name="company_revenue_range"
                value={formData.company_revenue_range}
                onChange={handleChange}
                placeholder="$1M - $10M"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company LinkedIn
              </label>
              <input
                type="url"
                name="company_linkedin_url"
                value={formData.company_linkedin_url}
                onChange={handleChange}
                placeholder="https://www.linkedin.com/company/name"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mr-3 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            {loading ? 'Saving...' : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Save Lead
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
} 