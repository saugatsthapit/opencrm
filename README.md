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