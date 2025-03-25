# CRM Lead Sequence Manager

A modern CRM system for managing leads and automated sequences, built with React, Supabase, and Node.js.

## Features

### Lead Management
- Import leads from CSV/Excel files
- Automatic duplicate detection
- Rich lead profiles with company information
- Bulk lead operations (delete, add to sequence)

### Sequence Automation
- Create multi-step sequences with:
  - Email campaigns
  - Phone call reminders
  - LinkedIn connection requests
- Customizable wait times between steps
- Dynamic placeholders for personalization
- Version control for sequence updates

### Email Integration
- SMTP email server integration
- HTML email templates
- Personalized email sending
- Email tracking and status monitoring

### Manual Step Tracking
- Mark manual steps as complete
- Add notes for phone calls and LinkedIn interactions
- Track completion status and history

### Workflow Management
- Automatic sequence progression
- Step-by-step workflow visualization
- Pause/resume sequence execution
- Error handling and status tracking

## Tech Stack

- **Frontend:**
  - React with TypeScript
  - Tailwind CSS for styling
  - React Router for navigation
  - Lucide React for icons

- **Backend:**
  - Node.js with Express
  - Supabase for database and authentication
  - Nodemailer for email handling

## Prerequisites

- Node.js 18 or higher
- Supabase account
- SMTP email server credentials

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Email Configuration
VITE_EMAIL_HOST=your_smtp_host
VITE_EMAIL_PORT=smtp_port
VITE_EMAIL_SECURE=true_or_false
VITE_EMAIL_USER=your_email
VITE_EMAIL_PASSWORD=your_email_password
```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd crm-sequence-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will start in development mode:
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:8000](http://localhost:8000)

## Database Schema

### Tables

#### sequences
- `id`: UUID (Primary Key)
- `name`: Text
- `description`: Text
- `created_at`: Timestamp
- `user_id`: UUID (Foreign Key)
- `enabled`: Boolean
- `version`: Integer

#### sequence_steps
- `id`: UUID (Primary Key)
- `sequence_id`: UUID (Foreign Key)
- `step_type`: Text ('email', 'call', 'linkedin_request')
- `step_order`: Integer
- `configuration`: JSONB
- `created_at`: Timestamp
- `wait_time`: Integer
- `wait_time_unit`: Text ('minutes', 'hours', 'days')

#### leads
- `id`: UUID (Primary Key)
- Various lead information fields
- `created_at`: Timestamp
- `user_id`: UUID (Foreign Key)

#### lead_sequences
- `id`: UUID (Primary Key)
- `lead_id`: UUID (Foreign Key)
- `sequence_id`: UUID (Foreign Key)
- `current_step`: Integer
- `status`: Text
- `created_at`: Timestamp
- `paused_at`: Timestamp
- `next_execution`: Timestamp

#### step_completions
- `id`: UUID (Primary Key)
- `lead_sequence_id`: UUID (Foreign Key)
- `step_id`: UUID (Foreign Key)
- `completed_at`: Timestamp
- `notes`: Text
- `completed_by`: UUID (Foreign Key)

## Usage

### Managing Leads

1. **Import Leads:**
   - Click "Upload Leads" on the dashboard
   - Select a CSV/Excel file with lead data
   - System automatically detects and handles duplicates

2. **Add Leads to Sequence:**
   - Select leads from the dashboard
   - Click "Add to Sequence"
   - Choose existing sequence or create new

### Creating Sequences

1. **Create New Sequence:**
   - Navigate to Sequences page
   - Click "Create Sequence"
   - Add sequence name and description
   - Add steps (email, call, LinkedIn)
   - Configure wait times between steps

2. **Configure Steps:**
   - **Email Steps:**
     - Add subject and message
     - Use placeholders for personalization
     - Set wait time before next step
   
   - **Manual Steps (Call/LinkedIn):**
     - Add notes/script
     - Set completion requirements
     - Configure follow-up timing

### Monitoring & Management

1. **Dashboard:**
   - View all leads and their sequence status
   - Monitor sequence progress
   - Handle failed steps

2. **Sequence Management:**
   - Enable/disable sequences
   - Edit sequence steps
   - Version control for changes

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

# Cold Calling Configuration Guide

## Setup for Testing Cold Calling

To properly test the cold calling feature with Twilio, follow these steps:

### Local Development Setup

1. Run your local API server:
   ```
   npm run server
   ```

2. Run your local frontend:
   ```
   npm run client
   ```

3. The local frontend will automatically proxy API requests to your local server.

### Testing with the Production Frontend

If you want to test with the production frontend at `https://fastcrm.netlify.app`, you need to:

1. Run your local API server:
   ```
   npm run server
   ```

2. Install and set up ngrok:
   
   a. Sign up for a free ngrok account at https://dashboard.ngrok.com/signup
   
   b. After signing up, get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
   
   c. Configure ngrok with your auth token:
   ```
   npx ngrok authtoken YOUR_AUTH_TOKEN
   ```
   
   d. Start ngrok to create a public URL for your local server:
   ```
   npx ngrok http 8002
   ```
   
   e. Copy the HTTPS URL provided by ngrok (e.g., `https://abcd1234.ngrok.io`).

3. Update your `.env` file with this URL:
   ```
   VITE_APP_URL=https://your-ngrok-url
   ```

4. Restart your server.

5. Now you can use the production frontend at `https://fastcrm.netlify.app` and it will connect to your local API server through ngrok.

## Why This Setup Is Necessary

- Twilio requires publicly accessible webhook URLs to handle call events.
- When testing locally, your server is only accessible from your machine.
- The ngrok tool creates a secure tunnel to your local server, making it accessible from the internet.

## Deploying to Production

For a complete production setup, you would need to:

1. Deploy your frontend to Netlify (already done at `https://fastcrm.netlify.app`).
2. Deploy your backend API server to a hosting service like Heroku, Render, or DigitalOcean.
3. Configure your frontend to use the URL of your deployed backend.

## Twilio Configuration

Make sure your Twilio account has the following:

1. A verified phone number to make outbound calls.
2. Proper credentials (Account SID, Auth Token) in your `.env` file.
3. Sufficient funds in your Twilio account for making real calls.

## Troubleshooting

- If calls are not connecting, check the server logs for Twilio error messages.
- Ensure your ngrok URL is properly set in the `.env` file.
- Verify that the CORS settings allow connections from your frontend domain.

# FastCRM - CRM with Cold Calling Features

A modern CRM application with integrated cold calling capabilities, email sequences, and analytics.

## CORS and API Connectivity Setup

This application can be run in two modes:
1. Local development with direct connectivity
2. Remote access through ngrok tunneling

### Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server and client:
   ```bash
   npm run dev
   ```

This will start:
- The React client on http://localhost:5173
- The API server on http://localhost:8002

### Remote Access with ngrok

To make your local development server accessible from the internet (useful for testing webhooks, mobile device access, or sharing with team members), you can use ngrok.

#### Setup ngrok

1. Install ngrok: https://ngrok.com/download

2. Start ngrok to create a tunnel to your local server:
   ```bash
   ngrok http 8002
   ```

3. Copy the generated ngrok URL (e.g., https://abcd1234.ngrok-free.app)

4. Run our setup script that will configure the application to use your ngrok URL:
   ```bash
   npm run setup-ngrok
   ```
   
5. The script will prompt you to enter your ngrok URL and will update the `.env.local` file accordingly.

6. Restart your development server:
   ```bash
   npm run dev
   ```

7. Your application will now use the ngrok URL for API calls.

#### Troubleshooting Connectivity Issues

If you encounter connectivity issues:

1. Visit the Settings page in the application and use the "API Connectivity Test" section to diagnose connectivity problems.

2. Check common issues:
   - Ensure ngrok is running and the URL is correctly configured
   - Verify the server is running on port 8002
   - Look for CORS errors in the browser console
   - Make sure your ngrok URL matches the one configured in the app

3. The API server has two special endpoints for testing:
   - `/api/health` - Returns basic server status
   - `/api/cors-test` - Tests CORS configuration

## Features

- Dashboard with lead overview and analytics
- Cold calling with call tracking and notes
- Email sequence management
- CRM functionality with lead management
- Settings for integration configuration

## Technologies

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Node.js, Express
- Integrations: Twilio, Email Services, LinkedIn API

## Development

The application consists of two main parts:

- Client: Located in `src/` directory, React application built with Vite
- Server: Located in `server/` directory, Express API server

### Environment Variables

Key environment variables:

- `VITE_NGROK_URL`: ngrok URL for remote API access
- `VITE_API_URL`: Full API URL (optional, derived from ngrok URL if not provided)
- `PORT`: Server port (default: 8002)
- `HOST`: Server host (default: 0.0.0.0)

These can be configured in `.env.local` (recommended for development).