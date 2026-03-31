import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single';

  return {
    plugins: [
      react(),
      tailwindcss(),
      isSingle && viteSingleFile(),
    ].filter(Boolean),
    build: {
      target: 'esnext',
      outDir: isSingle ? 'dist-single' : 'dist',
      assetsInlineLimit: isSingle ? Infinity : 4096,
    },
    base: isSingle ? '' : './',
    worker: { format: 'iife' },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
