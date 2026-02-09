import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4321,
  },
  resolve: {
    alias: {
      '@milkly/mkly': path.resolve(__dirname, '../mkly/src/index.ts'),
      '@mkly-kits/newsletter': path.resolve(__dirname, '../mkly-kits/newsletter/src/index.ts'),
      '@mkly-plugins/email': path.resolve(__dirname, '../mkly-plugins/email/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@milkly/mkly', '@mkly-kits/newsletter', '@mkly-plugins/email'],
  },
});
