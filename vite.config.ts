import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Define interface for environment variables
interface EnvVars {
  [key: string]: string;
}

// Load environment variables directly from .env file
function loadEnvFromFile(): EnvVars {
  try {
    const envPath = path.resolve('.env');
    console.log('Looking for .env file at:', envPath);
    
    if (fs.existsSync(envPath)) {
      console.log('.env file found');
      const envFile = fs.readFileSync(envPath, 'utf8');
      const envVars: EnvVars = {};
      
      envFile.split('\n').forEach(line => {
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) return;
        
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        
        if (key && value) {
          // Remove comments from values
          const cleanValue = value.split('#')[0].trim().replace(/^["']|["']$/g, '');
          envVars[key.trim()] = cleanValue;
        }
      });
      
      console.log('Parsed environment variables:', envVars);
      return envVars;
    } else {
      console.log('.env file not found');
      return {};
    }
  } catch (error) {
    console.error('Error loading .env file:', error);
    return {};
  }
}

// Try to load environment from .env.local file which might have user-specific overrides
function loadEnvFromLocalFile(): EnvVars {
  try {
    const envPath = path.resolve('.env.local');
    console.log('Looking for .env.local file at:', envPath);
    
    if (fs.existsSync(envPath)) {
      console.log('.env.local file found');
      const envFile = fs.readFileSync(envPath, 'utf8');
      const envVars: EnvVars = {};
      
      envFile.split('\n').forEach(line => {
        // Skip empty lines and comments
        if (!line || line.startsWith('#')) return;
        
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        
        if (key && value) {
          // Remove comments from values
          const cleanValue = value.split('#')[0].trim().replace(/^["']|["']$/g, '');
          envVars[key.trim()] = cleanValue;
        }
      });
      
      console.log('Parsed local environment variables:', envVars);
      return envVars;
    } else {
      console.log('.env.local file not found');
      return {};
    }
  } catch (error) {
    console.error('Error loading .env.local file:', error);
    return {};
  }
}

// Configure proxy for call API routes specifically
const configureCallsProxyHandler = (proxy: any) => {
  proxy.on('error', (err: any, req: any, res: any) => {
    console.log('❌ Calls API Proxy error:', err);
    
    // If this is a CORS preflight request that fails, provide a meaningful response
    if (req.method === 'OPTIONS') {
      console.log('📋 Handling OPTIONS request for calls API');
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        'Content-Length': '0'
      });
      res.end();
      console.log('✅ Responded to OPTIONS request for calls API with CORS headers');
    }
  });
  
  proxy.on('proxyReq', (proxyReq: any, req: any, _res: any) => {
    console.log(`⬆️ Proxying calls request: ${req.method} ${req.url}`);
    
    // Log headers for debugging
    if (req.method === 'OPTIONS' || req.method === 'POST') {
      console.log('📋 Calls API Request headers:', req.headers);
    }
  });
  
  proxy.on('proxyRes', (proxyRes: any, req: any, _res: any) => {
    const status = proxyRes.statusCode || 0;
    const statusText = status >= 200 && status < 300 ? '✅' : '❌';
    console.log(`⬇️ ${statusText} Calls API Response: ${status} for ${req.method} ${req.url}`);
    
    // Log response headers for calls API debugging
    console.log('📋 Calls API Response headers:', proxyRes.headers);
  });
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files with different priorities
  const envFromVite = loadEnv(mode, process.cwd(), '');
  const envFromFile = loadEnvFromFile();
  const envFromLocalFile = loadEnvFromLocalFile();
  
  // Get NGROK_URL from all possible sources with priority
  const ngrokUrl = envFromLocalFile.VITE_NGROK_URL || 
                   envFromLocalFile.NGROK_URL || 
                   envFromFile.VITE_NGROK_URL || 
                   envFromFile.NGROK_URL || 
                   envFromVite.VITE_NGROK_URL || 
                   envFromVite.NGROK_URL;
                   
  // Get API_URL from environment with priority
  const apiUrl = envFromLocalFile.VITE_API_URL || 
                 envFromFile.VITE_API_URL || 
                 envFromVite.VITE_API_URL;
  
  // Default server port and host
  const serverPort = process.env.PORT || 8002;
  const serverHost = process.env.HOST || '0.0.0.0';
  
  // Log environment configuration
  console.log('=============================================');
  console.log('🔧 Vite Configuration');
  console.log('=============================================');
  console.log('NGROK_URL:', ngrokUrl || '(not set)');
  console.log('API_URL:', apiUrl || '(not set)');
  console.log('Server port:', serverPort);
  console.log('Server host:', serverHost);
  console.log('Mode:', mode);
  console.log('=============================================');
  
  // Determine proxy target - use ngrokUrl, apiUrl, or localhost
  const proxyTarget = ngrokUrl || apiUrl || `http://localhost:${serverPort}`;
  console.log('📡 API proxy target:', proxyTarget);
  
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    define: {
      // Make environment variables available globally
      '__NGROK_URL__': JSON.stringify(ngrokUrl),
      '__API_URL__': JSON.stringify(apiUrl),
      // Ensure these are available in import.meta.env
      'import.meta.env.NGROK_URL': JSON.stringify(ngrokUrl),
      'import.meta.env.VITE_NGROK_URL': JSON.stringify(ngrokUrl),
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl)
    },
    server: {
      port: 5173,
      strictPort: false,
      cors: {
        origin: '*',
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
      },
      proxy: {
        // Specific proxy for calls API
        '/api/v1/calls': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          configure: configureCallsProxyHandler
        },
        // General proxy for other API requests
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path) => {
            console.log(`🔄 Rewriting API path: ${path}`);
            return path;
          },
          configure: (proxy, _options) => {
            proxy.on('error', (err, req, res) => {
              console.log('❌ Proxy error:', err);
              
              // If this is a CORS preflight request that fails, provide a meaningful response
              if (req.method === 'OPTIONS') {
                res.writeHead(200, {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
                  'Access-Control-Allow-Credentials': 'true',
                  'Access-Control-Max-Age': '86400',
                  'Content-Length': '0'
                });
                res.end();
                console.log('✅ Responded to OPTIONS request with CORS headers');
              }
            });
            
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log(`⬆️ Proxying request: ${req.method} ${req.url} → ${proxyTarget}${proxyReq.path}`);
              
              // Log headers for debugging
              if (req.method === 'OPTIONS') {
                console.log('📋 Request headers:', req.headers);
              }
            });
            
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              const status = proxyRes.statusCode || 0;
              const statusText = status >= 200 && status < 300 ? '✅' : '❌';
              console.log(`⬇️ ${statusText} Response: ${status} for ${req.method} ${req.url}`);
              
              // Log response headers for CORS debugging
              if (req.method === 'OPTIONS' || status !== 200) {
                console.log('📋 Response headers:', proxyRes.headers);
              }
            });
          }
        }
      },
    }
  };
});