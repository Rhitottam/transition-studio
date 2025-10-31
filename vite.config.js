import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  base: '/transition-studio/',
  worker: {
    format: 'es'
  },
  server: {
    port: 4000
  }
});
