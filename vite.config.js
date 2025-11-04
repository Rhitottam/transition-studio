import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/transition-studio/',
  worker: {
    format: 'es'
  },
  server: {
    allowedHosts: ['920d31ba08da.ngrok-free.app', 'localhost'],
    port: 4000
  }
});
