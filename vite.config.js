import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // El Client ID de Google es público: se comparte con el frontend desde el mismo .env
  envPrefix: ['VITE_', 'GOOGLE_'],
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      '/api': 'http://127.0.0.1:3001'
    }
  }
});
