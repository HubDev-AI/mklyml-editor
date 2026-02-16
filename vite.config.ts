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
      '@mklyml/core': path.resolve(__dirname, '../mkly/src/index.ts'),
      '@mklyml/kits/newsletter': path.resolve(__dirname, '../mkly-kits/newsletter/src/index.ts'),
      '@mklyml/kits/docs': path.resolve(__dirname, '../mkly-kits/docs/src/index.ts'),
      '@mklyml/plugins/email': path.resolve(__dirname, '../mkly-plugins/email/src/index.ts'),
      '@mklyml/plugins/docs': path.resolve(__dirname, '../mkly-plugins/docs/src/index.ts'),
      '@mklyml/plugins/seo': path.resolve(__dirname, '../mkly-plugins/seo/src/index.ts'),
      '@mklyml/plugins/newsletter-ai': path.resolve(__dirname, '../mkly-plugins/newsletter-ai/src/index.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['@mklyml/core', '@mklyml/kits', '@mklyml/plugins'],
  },
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/,
        },
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        banner: '/*! MklyML Editor - Proprietary and Confidential. All Rights Reserved. */',
      },
    },
  },
});
