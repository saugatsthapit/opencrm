const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const emailRoutes = require('./routes/email.js');
const callRoutes = require('./routes/calls.js');
const { processWorkflowSteps } = require('./services/workflowService.js');

dotenv.config();

const app = express();

// Enhanced CORS setup for all routes
const corsOptions = {
  origin: function (origin, callback) {
    // Log the incoming origin for debugging
    console.log(`[CORS] Request from origin: ${origin || 'no origin'}`);
    
    // Allow requests with no origin (like mobile apps, curl requests, etc)
    if (!origin) {
      console.log('[CORS] Allowing request with no origin');
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173', 
      'https://fastcrm.netlify.app',
      /^https:\/\/.*\.ngrok-free\.app$/  // Allow any ngrok domain
    ];
    
    // Check exact matches first
    const isAllowedExact = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowedExact) {
      console.log(`[CORS] Allowing request from origin: ${origin}`);
      return callback(null, true);
    }
    
    // If not matching any allowed pattern, reject
    console.log(`[CORS] Rejecting request from origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware with our enhanced options
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly at the top level
app.options('*', (req, res) => {
  console.log(`[CORS] Global OPTIONS handler for ${req.path} from origin: ${req.headers.origin}`);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(204);
});

app.use(express.json());

// Add before the routes
app.use((req, res, next) => {
  console.log('\n=== INCOMING REQUEST ===');
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('======================\n');
  next();
});

// Routes
app.use('/api/v1/calls', callRoutes);
app.use('/api/v1/email', emailRoutes);

// Add a specific CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working correctly!',
    timestamp: new Date().toISOString(),
    requestHeaders: {
      origin: req.headers.origin,
      host: req.headers.host,
      referer: req.headers.referer
    },
    responseHeaders: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods'),
      'access-control-allow-headers': res.getHeader('Access-Control-Allow-Headers'),
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
});

// Add a test endpoint to confirm the server is reachable
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'up', 
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    origin: req.headers.origin || 'unknown',
    cors: {
      headers: {
        'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
        'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods'),
        'access-control-allow-headers': res.getHeader('Access-Control-Allow-Headers'),
        'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
      }
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(500).json({
    error: err.message || 'Something went wrong',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Run workflow processor every minute
setInterval(processWorkflowSteps, 60000);

// Initial run
processWorkflowSteps();

// Get port from environment or use default
// Important: Ensure this matches your ngrok configuration
const PORT = process.env.PORT || 8002; // Changed to 8002 to match Vite proxy default
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

console.log('Environment variables:');
console.log('- PORT:', process.env.PORT);
console.log('- HOST:', process.env.HOST);
console.log('- NGROK_URL:', process.env.NGROK_URL);
console.log('- VITE_APP_URL:', process.env.VITE_APP_URL);

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Server available at http://localhost:${PORT}`);
  
  if (process.env.NGROK_URL) {
    console.log(`Server available via ngrok at ${process.env.NGROK_URL}`);
  }
  
  console.log(`Tracking URL base: ${process.env.VITE_APP_URL || process.env.NGROK_URL || `http://localhost:${PORT}`}`);
  console.log(`Make sure this URL is accessible from the internet for email tracking to work`);
  console.log(`CORS is configured to allow requests from any origin`);
});