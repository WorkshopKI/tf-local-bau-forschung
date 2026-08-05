import { defineConfig } from 'vitest/config';
import path from 'path';

// Eigene Vitest-Config statt der vite.config.ts — Tests brauchen weder
// React- noch Tailwind- noch Singlefile-Plugins, und das Define-System
// (__TEAMFLOW_CONFIG__ etc.) wird hier zentral gestellt damit Module, die
// `runtimeConfig` importieren, nicht crashen.

// Testdateien mit geteiltem Modul-Zustand (Module-Level-Singletons/Mocks),
// die bei isolate:false andere Tests kontaminieren — laufen im Projekt 'isolated'
// mit Standard-Isolation. Neue Wackelkandidaten hier ergänzen (Verfahren: CLAUDE.md).
const ISOLATED_TESTS = [
  'src/core/services/assistent/protokoll/__tests__/recorder.test.ts',
  'src/core/services/csv/__tests__/importer-source-baseline.test.ts',
  'src/core/services/csv/__tests__/merger-scoped-load.test.ts',
  'src/core/services/csv/__tests__/snapshot-verbuende-guard.test.ts',
  'src/core/services/csv/__tests__/unterprogramm-registry.test.ts',
  'src/core/services/embedding-corpus/__tests__/storage.test.ts',
  // Mockt `feedbackStorage` + `feedbackSharedFile` modulweit — dieselben Module
  // wie `sponsorTicketUpsert.test.ts` weiter unten. Ohne Isolation fiel die
  // Datei sporadisch mit vier Fehlschlägen aus (einzeln immer grün, im Suite-Lauf
  // je nach Ladereihenfolge).
  'src/core/services/feedback/__tests__/addComment.test.ts',
  // Mockt `screenContext` modulweit; sobald eine weitere Feedback-Testdatei die
  // Ladereihenfolge im gemeinsamen Modul-Register verschiebt, greift der Mock
  // nicht mehr (die Prompts kamen ohne APP-OVERVIEW-Marker an).
  'src/core/services/feedback/__tests__/feedbackImprove.test.ts',
  'src/core/services/feedback/__tests__/sponsorTicketUpsert.test.ts',
  'src/core/services/infrastructure/__tests__/listPendingGrants.test.ts',
  'src/core/services/personal-storage/__tests__/updateOutboxFeedback.test.ts',
  'src/core/services/search/__tests__/ort-wasm-init.test.ts',
  'src/core/services/skill-feedback/__tests__/export.test.ts',
  'src/core/services/skill-feedback/__tests__/read.test.ts',
  'src/core/services/skill-feedback/__tests__/selfcheck.test.ts',
  'src/core/status/__tests__/byte-identitaet.test.ts',
  // Beide mocken die Share-Schicht des Journals; ohne Isolation greifen ihre
  // Mocks ineinander.
  'src/core/status/__tests__/journal-lauf.test.ts',
  'src/core/status/__tests__/journal-lesen.test.ts',
  // Mockt dieselbe Share-Schicht (`sidecar-datei`) wie die Journal-Tests.
  'src/core/status/__tests__/katalog-share.test.ts',
  'src/core/status/__tests__/katalog-store.test.ts',
  'src/core/status/__tests__/reconcile-store.test.ts',
  'src/core/status/__tests__/trigger-share.test.ts',
  'src/plugins/auslastung/__tests__/assign-verbund.test.ts',
  'src/plugins/auslastung/__tests__/auslastung-coldstart-guard.test.ts',
  'src/plugins/auslastung/__tests__/auslastung-crosstab-reload.test.ts',
  'src/plugins/auslastung/__tests__/freigeben-bulk.test.ts',
  'src/plugins/auslastung/__tests__/kuerzelmap-coldstart-guard.test.ts',
  'src/plugins/auslastung/__tests__/persist-debounce.test.ts',
  'src/plugins/auslastung/__tests__/reconcile-zuweisungen.test.ts',
  'src/plugins/auslastung/__tests__/verbund-aggregation-livecache.test.ts',
];

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
    __TEAMFLOW_APP_VERSION__: JSON.stringify('0.0.0-test'),
    __TEAMFLOW_DEV_FIXTURES__: JSON.stringify(true),
    // Variante „local" ist im Test IMMER aus: die reinen local-fs-Module werden
    // direkt importiert und getestet, die Einhaengepunkte sollen den Normalpfad
    // fahren (sonst synthetisierte jeder Handle-Test Fake-Slots).
    __TEAMFLOW_LOCAL_FS__: JSON.stringify(false),
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
    setupFiles: ['src/phase2/__tests__/setup-pdfjs.ts'],
    testTimeout: 60000,
    projects: [
      {
        extends: true,
        test: {
          name: 'fast',
          include: ['src/**/__tests__/*.test.ts'],
          exclude: ISOLATED_TESTS,
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'isolated',
          include: ISOLATED_TESTS,
        },
      },
    ],
  },
});
