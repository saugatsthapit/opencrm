interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailTemplate {
  subject: string;
  message: string;
}

class EmailService {
  private apiUrl: string;

  constructor() {
    this.apiUrl = 'http://localhost:8000/api/v1/email';
  }

  async sendSequenceEmail(to: string, template: EmailTemplate, placeholders: Record<string, string>) {
    try {
      const response = await fetch(`${this.apiUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_email: to,
          subject: template.subject,
          html_content: template.message,
          placeholders
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  async sendTestEmail(to: string, subject: string, message: string) {
    try {
      const response = await fetch(`${this.apiUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_email: to,
          subject,
          html_content: message,
          placeholders: {}
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending test email:', error);
      throw new Error('Failed to send email');
    }
  }

  async verifyConnection() {
    try {
      const response = await fetch(`${this.apiUrl}/test`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to verify email configuration');
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error verifying email connection:', error);
      return false;
    }
  }

  async getConfig() {
    try {
      const response = await fetch(`${this.apiUrl}/config`);
      
      if (!response.ok) {
        throw new Error('Failed to get email configuration');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting email configuration:', error);
      throw new Error('Failed to get email configuration');
    }
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
export { emailService };