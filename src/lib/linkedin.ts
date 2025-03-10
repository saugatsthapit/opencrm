interface LinkedInConfig {
  accessToken: string;
}

class LinkedInService {
  private config: LinkedInConfig;

  constructor() {
    this.config = {
      accessToken: import.meta.env.VITE_LINKEDIN_ACCESS_TOKEN || '',
    };
  }

  async sendConnectionRequest(profileId: string, message: string, placeholders: Record<string, string>) {
    try {
      // Replace placeholders in message
      let customMessage = message;
      Object.entries(placeholders).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        customMessage = customMessage.replace(new RegExp(placeholder, 'g'), value);
      });

      // Mock sending connection request
      console.log('Sending LinkedIn connection request:', {
        profileId,
        message: customMessage,
      });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return { success: true, requestId: `mock-${Date.now()}` };
    } catch (error) {
      console.error('Error sending LinkedIn connection request:', error);
      throw error;
    }
  }

  async verifyConnection() {
    try {
      // Mock verification by checking if access token exists
      const isConfigured = Boolean(this.config.accessToken);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return isConfigured;
    } catch (error) {
      console.error('LinkedIn API connection error:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
export const linkedInService = new LinkedInService();