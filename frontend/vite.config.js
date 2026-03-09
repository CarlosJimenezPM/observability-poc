import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',  // Forzar IPv4
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:4001',
        changeOrigin: true
      },
      '/cubejs-api': {
        target: process.env.CUBE_URL || 'http://cube:4000',
        changeOrigin: true
      }
    }
  }
});
