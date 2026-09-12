import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base keeps `npm run preview`, desktop file:// preview,
// and GitHub Pages project sites working without config changes.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  worker: { format: 'es' },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 }
});
