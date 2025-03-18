const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Create reusable transporter with proper configuration for Zoho SMTP
const transporter = nodemailer.createTransport({
  host: process.env.VITE_EMAIL_HOST,
  port: parseInt(process.env.VITE_EMAIL_PORT),
  secure: process.env.VITE_EMAIL_SECURE === 'true',
  auth: {
    user: process.env.VITE_EMAIL_USER,
    pass: process.env.VITE_EMAIL_PASSWORD,
  },
  // Add additional configuration for reliability
  pool: true, // Use pooled connections
  maxConnections: 1, // Limit concurrent connections
  maxMessages: 50, // Limit messages per connection
  // Add reasonable timeouts
  connectionTimeout: 30000, // 30 seconds
  greetingTimeout: 30000, // 30 seconds
  socketTimeout: 60000, // 60 seconds
  // TLS configuration for Zoho
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  },
  // Debug options
  debug: true, // Enable debugging
  logger: true // Log to console
});

// Test the connection on startup with proper error handling
const testConnection = async () => {
  try {
    console.log('Testing email connection...');
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    // Don't throw, just log the error
    return false;
  }
};

// Initialize connection test
testConnection();

const getEmailConfig = () => ({
  host: process.env.VITE_EMAIL_HOST,
  port: parseInt(process.env.VITE_EMAIL_PORT),
  secure: process.env.VITE_EMAIL_SECURE === 'true',
  user: process.env.VITE_EMAIL_USER,
});

module.exports = { transporter, getEmailConfig };