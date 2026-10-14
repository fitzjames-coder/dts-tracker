import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-only PWA. No proxies, no external services.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
  },
});
