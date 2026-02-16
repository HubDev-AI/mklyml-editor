import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['src/main.tsx', 'src/App.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
      tsconfigPath: path.resolve(__dirname, 'tsconfig.lib.json'),
    }),
  ],
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
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
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
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@mklyml/core',
        '@mklyml/kits/newsletter',
        '@mklyml/kits/docs',
        '@mklyml/plugins/email',
        '@mklyml/plugins/docs',
        '@mklyml/plugins/seo',
        '@mklyml/plugins/newsletter-ai',
        'zod',
        'zustand',
      ],
      output: {
        banner: '/*! MklyML Editor - Proprietary and Confidential. All Rights Reserved. */',
        assetFileNames: 'style[extname]',
      },
    },
    cssCodeSplit: false,
  },
});
