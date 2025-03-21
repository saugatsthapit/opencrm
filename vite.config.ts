import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://27d4-2601-483-4400-1210-5c4e-1649-f98-7a97.ngrok-free.app', // Using ngrok URL instead of localhost
        changeOrigin: true,
        secure: false,
      }
    },
  }
});