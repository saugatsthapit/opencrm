const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const emailRoutes = require('./routes/email.js');
const callRoutes = require('./routes/calls.js');
const { processWorkflowSteps } = require('./services/workflowService.js');

dotenv.config();

const app = express();

// Configure CORS to allow requests from both localhost and the production domain
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://fastcrm.netlify.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

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
});