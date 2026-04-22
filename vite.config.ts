import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { DEFAULT_CONFIG } from './scripts/config-schema.mjs';

export default defineConfig(({ mode }) => {
  const isSingle = mode === 'single';

  // Config kommt entweder aus dem Build-Orchestrator (scripts/build-with-config.mjs)
  // via Env-Var oder als Fallback aus DEFAULT_CONFIG (dev server, generisches `vite build`).
  const rawConfig = process.env.TEAMFLOW_CONFIG ?? JSON.stringify(DEFAULT_CONFIG);
  const buildTime = process.env.TEAMFLOW_BUILD_TIME ?? new Date().toISOString();
  const gitHash = process.env.TEAMFLOW_GIT_HASH ?? 'unknown';

  // Parse rawConfig, um einzelne Flags als Literal-Defines verfügbar zu machen.
  // Literal-Defines werden vom Minifier als Konstanten behandelt und erlauben
  // Dead-Code-Elimination (Akzeptanz-Kriterium: keine Fixture-Funktionen im Prod-Bundle).
  const parsedConfig = JSON.parse(rawConfig);
  const devFixturesEnabled = Boolean(parsedConfig.features?.devFixtures);

  return {
    plugins: [
      react(),
      tailwindcss(),
      isSingle && viteSingleFile(),
    ].filter(Boolean),
    define: {
      __TEAMFLOW_CONFIG__: rawConfig,
      __TEAMFLOW_BUILD_TIME__: JSON.stringify(buildTime),
      __TEAMFLOW_GIT_HASH__: JSON.stringify(gitHash),
      __TEAMFLOW_DEV_FIXTURES__: JSON.stringify(devFixturesEnabled),
    },
    build: {
      target: 'esnext',
      outDir: isSingle ? 'dist-single' : 'dist',
      emptyOutDir: !isSingle,
      assetsInlineLimit: isSingle ? Infinity : 4096,
    },
    base: isSingle ? '' : './',
    worker: { format: 'iife' },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      watch: {
        ignored: ['**/_reference/**'],
      },
    },
  };
});
