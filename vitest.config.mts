import { defineConfig } from 'vitest/config';
import path from 'path';

// Eigene Vitest-Config statt der vite.config.ts — Tests brauchen weder
// React- noch Tailwind- noch Singlefile-Plugins, und das Define-System
// (__TEAMFLOW_CONFIG__ etc.) wird hier zentral gestellt damit Module, die
// `runtimeConfig` importieren, nicht crashen.
export default defineConfig({
  define: {
    __TEAMFLOW_CONFIG__: JSON.stringify({
      configVersion: 1,
      variant: 'development',
      build: { label: 'Test', outputFilename: 'test', browserTabTitle: 'Test' },
      data: { fixedDataSharePath: null, allowUserToChangePath: true, allowLocalFallback: true, demoDataBundled: false },
      features: {
        kuratorMenus: true, feedback: true, dokumentenscan: true, volltextsuche: true,
        devInfraPanel: true, devFixtures: true, antraege: true, bauantraege: false, dokumente: false,
      },
      menuLabels: { antraege: 'Förderanträge' },
      ki: { localLlama: { enabled: true, endpoint: 'http://localhost:8081' }, openrouter: { enabled: false, allowedModels: [] } },
      branding: { logoUrl: null, primaryColor: null },
      scan: {
        sub_roots: [],
        file_extensions: ['.pdf', '.docx'],
        max_depth: 20,
        fkz_allowed_prefixes: ['16EP', '16KN', '16DS', '16DL'],
      },
    }),
    __TEAMFLOW_BUILD_TIME__: JSON.stringify('1970-01-01T00:00:00Z'),
    __TEAMFLOW_GIT_HASH__: JSON.stringify('test'),
    __TEAMFLOW_DEV_FIXTURES__: JSON.stringify(true),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Tests laufen in Node — pdfjs-dist Hauptbuild braucht WebCrypto+DOMMatrix.
      // Der `legacy`-Build ist Node-kompatibel und liefert das gleiche API.
      'pdfjs-dist': path.resolve(__dirname, './node_modules/pdfjs-dist/legacy/build/pdf.mjs'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/*.test.ts'],
    setupFiles: ['src/phase2/__tests__/setup-pdfjs.ts'],
    testTimeout: 60000,
  },
});
