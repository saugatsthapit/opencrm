const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const emailRoutes = require('./routes/email.js');
const callRoutes = require('./routes/calls.js');
const { processWorkflowSteps } = require('./services/workflowService.js');

dotenv.config();

const app = express();

// CORS pre-flight middleware to ensure proper CORS handling, especially for ngrok
app.options('*', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Configure CORS to allow requests from both localhost and the production domain
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests from any origin including ngrok domains
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Length', 'X-Requested-With'],
  credentials: true
};
app.use(cors(corsOptions));

// Add headers to every response to ensure CORS works
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.use(express.json());

// Routes
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/calls', callRoutes);

// Add a test endpoint to confirm the server is reachable
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'up', 
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    origin: req.headers.origin || 'unknown'
  });
});

// Run workflow processor every minute
setInterval(processWorkflowSteps, 60000);

// Initial run
processWorkflowSteps();

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Tracking URL base: ${process.env.VITE_APP_URL || `http://localhost:${PORT}`}`);
  console.log(`Make sure this URL is accessible from the internet for email tracking to work`);
  console.log(`CORS is configured to allow requests from any origin`);
});