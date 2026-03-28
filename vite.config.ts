import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single';
  const isDeploy = mode === 'deploy';

  return {
    plugins: [
      react(),
      tailwindcss(),
      (isSingle || isDeploy) && viteSingleFile(),
    ].filter(Boolean),
    define: {
      'import.meta.env.VITE_EMBED_MODE': JSON.stringify(isSingle ? 'inline' : 'external'),
    },
    build: {
      target: 'esnext',
      outDir: isSingle ? 'dist-single' : isDeploy ? 'dist-deploy' : 'dist',
      assetsInlineLimit: (isSingle || isDeploy) ? Infinity : 4096,
    },
    base: (isSingle || isDeploy) ? '' : './',
    worker: { format: 'es' },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
