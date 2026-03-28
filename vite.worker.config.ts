import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    target: 'esnext',
    outDir: 'dist-deploy',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/workers/embedding.worker.ts'),
      formats: ['es'],
      fileName: () => 'embedding-worker.js',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
