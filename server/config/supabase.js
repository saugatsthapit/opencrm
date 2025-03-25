const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client with the anon key (this has RLS enforced)
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize a service client if we have a service role key (this bypasses RLS)
let supabaseServiceClient;
try {
  if (supabaseUrl && supabaseServiceKey) {
    supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase service client initialized for bypassing RLS');
  }
} catch (error) {
  console.error('Error initializing Supabase service client:', error);
}

// Helper function to get the appropriate Supabase client
// Returns the service client if available (to bypass RLS) or the regular client
const getDbClient = () => {
  return supabaseServiceClient || supabase;
};

module.exports = { 
  supabase,
  supabaseServiceClient,
  getDbClient
};