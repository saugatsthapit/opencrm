const { spawn } = require('child_process');
const fs = require('fs');
const readline = require('readline');
const dotenv = require('dotenv');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check if authtoken is already set
function checkAuthToken() {
  return new Promise((resolve) => {
    console.log('Checking ngrok authentication status...');
    
    const checkProcess = spawn('npx', ['ngrok', 'authtoken', '--check'], { shell: true });
    
    checkProcess.stdout.on('data', (data) => {
      console.log(data.toString());
      if (data.toString().includes('Authtoken is valid')) {
        console.log('✅ ngrok auth token is already set up');
        resolve(true);
      }
    });
    
    checkProcess.stderr.on('data', (data) => {
      if (data.toString().includes('auth token check failed')) {
        console.log('⚠️ ngrok auth token is not set up yet');
        resolve(false);
      }
    });
    
    checkProcess.on('close', (code) => {
      if (code !== 0) {
        resolve(false);
      }
    });
  });
}

// Set up ngrok auth token
function setupAuthToken() {
  return new Promise((resolve) => {
    rl.question('Please enter your ngrok auth token (from https://dashboard.ngrok.com/get-started/your-authtoken): ', (token) => {
      console.log('Setting up ngrok auth token...');
      
      const authProcess = spawn('npx', ['ngrok', 'authtoken', token], { shell: true });
      
      authProcess.stdout.on('data', (data) => {
        console.log(data.toString());
      });
      
      authProcess.stderr.on('data', (data) => {
        console.error(data.toString());
      });
      
      authProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ ngrok auth token set up successfully');
          resolve(true);
        } else {
          console.error('❌ Failed to set up ngrok auth token');
          resolve(false);
        }
      });
    });
  });
}

// Start ngrok tunnel
function startNgrok(port) {
  return new Promise((resolve) => {
    console.log(`Starting ngrok tunnel to port ${port}...`);
    
    const ngrokProcess = spawn('npx', ['ngrok', 'http', port], { shell: true });
    
    let ngrokUrl = null;
    
    ngrokProcess.stdout.on('data', (data) => {
      console.log(data.toString());
      
      // Try to extract the ngrok URL
      const output = data.toString();
      const forwardingMatch = output.match(/Forwarding\s+(https:\/\/[a-zA-Z0-9-]+\.ngrok\.io)/);
      
      if (forwardingMatch && forwardingMatch[1] && !ngrokUrl) {
        ngrokUrl = forwardingMatch[1];
        console.log(`\n✅ ngrok URL: ${ngrokUrl}\n`);
        updateEnvFile(ngrokUrl, port);
        resolve(ngrokUrl);
      }
    });
    
    ngrokProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    // Keep the process running - user will need to manually kill with Ctrl+C
  });
}

// Update .env file with ngrok URL
function updateEnvFile(ngrokUrl, port) {
  try {
    dotenv.config();
    
    // Read current .env file
    const envPath = './.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update the VITE_APP_URL
    if (envContent.includes('VITE_APP_URL=')) {
      envContent = envContent.replace(
        /VITE_APP_URL=.*/,
        `VITE_APP_URL=${ngrokUrl}`
      );
    } else {
      envContent += `\nVITE_APP_URL=${ngrokUrl}\n`;
    }
    
    // Write back to file
    fs.writeFileSync(envPath, envContent);
    
    console.log(`✅ Updated .env file with ngrok URL: ${ngrokUrl}`);
    console.log('✅ Please restart your server to apply these changes');
    console.log(`\nYou can now use the production site at https://fastcrm.netlify.app/`);
    console.log(`It will connect to your local server through ngrok for API calls.\n`);
  } catch (error) {
    console.error('Error updating .env file:', error);
  }
}

// Main function
async function main() {
  try {
    console.log('=== FastCRM ngrok Setup ===');
    
    // Load environment variables
    dotenv.config();
    
    // Determine the port from the .env file or use default
    const port = process.env.PORT || 8002;
    
    // Check if auth token is already set
    const isAuthSet = await checkAuthToken();
    
    // If not set, prompt user to set it up
    if (!isAuthSet) {
      console.log('\nYou need to set up an ngrok account and auth token first.');
      console.log('1. Sign up at https://dashboard.ngrok.com/signup (it\'s free)');
      console.log('2. Get your auth token at https://dashboard.ngrok.com/get-started/your-authtoken');
      
      const tokenSet = await setupAuthToken();
      if (!tokenSet) {
        console.error('Failed to set up ngrok. Please try again.');
        rl.close();
        return;
      }
    }
    
    // Start ngrok (this will keep running until user kills it)
    await startNgrok(port);
    
    // Keep readline open for user to use Ctrl+C to exit
    console.log('\nPress Ctrl+C to stop the ngrok tunnel when you\'re done testing.');
    
  } catch (error) {
    console.error('Error:', error);
    rl.close();
  }
}

// Start the script
main(); 