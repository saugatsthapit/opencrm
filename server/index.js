const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const emailRoutes = require('./routes/email.js');
const callRoutes = require('./routes/calls.js');
const { processWorkflowSteps } = require('./services/workflowService.js');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/calls', callRoutes);

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