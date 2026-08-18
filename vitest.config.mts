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
  // Beide mocken `smb-handle` modulweit und fahren einen In-Memory-Share dagegen,
  // dessen Handle in einer `vi.hoisted`-Kapsel je Datei liegt. Ohne Isolation
  // bedient die zuerst registrierte Fabrik auch die andere Datei — der Merge las
  // dann eine leere Quell-Kopie, und der gehaltene Antrag kam ohne Felder zurück
  // (v4.16: die zweite Datei brachte die erste zu Fall, beide einzeln gruen).
  'src/core/services/csv/__tests__/importer-gefiltert-ist-keine-loeschung.test.ts',
  // Dieselbe Familie, anderes Modul: mockt `build-lock` modulweit. Der Guard
  // `spalten-hilfe-abdeckung` (v4.54) importiert in conventions-ui.test.ts die
  // Spalten-Registry und damit einen grossen Teil des Antraege-Modulgraphen —
  // das verschob die Ladereihenfolge, der Mock griff nicht mehr, und der
  // Importer lief in den ECHTEN Lock („anderes Fenster unter deinem Namen").
  // Einzeln immer gruen.
  'src/core/services/csv/__tests__/importer-join-column-guard.test.ts',
  'src/core/services/csv/__tests__/importer-lock-held-by-caller.test.ts',
  // Mockt `feature-flags` modulweit, um die Projektion der selbst angelegten
  // Spalten einzuschalten (v4.55). Ohne Isolation haengt es an der
  // Ladereihenfolge, ob der Mock greift — der Beutel `frei_roh` kam dann leer
  // zurueck. Einzeln immer gruen.
  'src/core/services/csv/__tests__/merge-behaelt-freie-spalten.test.ts',
  'src/core/services/csv/__tests__/importer-loeschung-nur-wenn-ueberall-weg.test.ts',
  'src/core/services/csv/__tests__/importer-source-baseline.test.ts',
  'src/core/services/csv/__tests__/merger-scoped-load.test.ts',
  // Gleiche Ursache eine Ebene höher: mockt `smb-handle` modulweit, um dem
  // Recompute nach dem Umwandeln der Demo-Quellen eine echte Quell-Kopie
  // unterzuschieben (v4.23).
  'src/plugins/csv-sources-kuration/services/__tests__/demo-zu-echt.test.ts',
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
  // Dritter Fall derselben Familie (v3.43): mockt `feedbackSharedFile` +
  // `feedbackStorage` wie `addComment`/`updateFeedbackLage` und reicht ein
  // absichtlich leeres `storage` durch. Greift der Modul-Mock wegen der
  // Ladereihenfolge nicht, läuft der ECHTE `readSharedFile` und stolpert über
  // `storage.idb` (`Cannot read properties of undefined (reading 'get')`).
  // Einzeln immer grün.
  'src/core/services/feedback/__tests__/feedbackOutboxCollect.test.ts',
  'src/core/services/feedback/__tests__/sponsorTicketUpsert.test.ts',
  // Dieselben zwei Module wie `addComment.test.ts` — die Datei war bis v3.22 nur
  // nicht an der Reihe. Mit den drei neuen Verlaufs-Testdateien (v3.23) kippte
  // die Ladereihenfolge, und der Mock griff nicht mehr (`idb.get is not a
  // function`, weil die echte Storage-Schicht durchkam). Einzeln immer grün.
  'src/core/services/feedback/__tests__/updateFeedbackLage.test.ts',
  // Mockt smb-handle/atomic-write/audit-log modulweit und faehrt den echten
  // Lock-Kern dagegen (Heartbeat-Takt, Freigabe-Verifikation).
  'src/core/services/infrastructure/__tests__/build-lock-freigabe.test.ts',
  'src/core/services/infrastructure/__tests__/listPendingGrants.test.ts',
  // Mockt `smb-handle` modulweit und reicht ein absichtlich leeres `idb` durch —
  // dieselbe Familie wie `updateFeedbackLage` oben, gleicher Fehlertext (`idb.get
  // is not a function`, weil die echte Handle-Schicht durchkommt). Bis v4.12 war
  // die Datei nur nicht an der Reihe; eine einzige zusaetzliche Testdatei (v4.13)
  // verschob die Ladereihenfolge im gemeinsamen Register. Einzeln immer gruen.
  'src/core/services/infrastructure/__tests__/schreibsperre-unlesbar.test.ts',
  // Mockt `@/config/personal-roots` modulweit (feste Wurzel-Liste statt
  // Build-Config) — ohne Isolation gewinnt der zuerst geladene echte Modulstand.
  'src/core/services/infrastructure/__tests__/userFoldersRootPermission.test.ts',
  'src/core/services/personal-storage/__tests__/updateOutboxFeedback.test.ts',
  // Mockt `ki-guard` modulweit, prueft damit aber `ein-schuss-lauf` — das
  // gemeinsame Modul, das seit v4.104 ALLE einschuessigen KI-Laeufe ausfuehrt.
  // Ohne Isolation hat eine fruehere Datei es mit dem ECHTEN ki-guard in die
  // geteilte Registry gelegt, und die Attrappe greift nicht mehr: der Lauf rief
  // `bridge.getStreamlitTransport` auf einer Bridge-Attrappe, die nur
  // `getTransportForDatenLauf` kennt. Einzeln gruen, im Suite-Lauf rot.
  'src/core/services/search/__tests__/frageplan-lauf.test.ts',
  'src/core/services/search/__tests__/wortformen-pruefung.test.ts',
  'src/core/services/search/__tests__/ort-wasm-init.test.ts',
  'src/core/services/skill-feedback/__tests__/export.test.ts',
  'src/core/services/skill-feedback/__tests__/read.test.ts',
  'src/core/services/skill-feedback/__tests__/selfcheck.test.ts',
  // Mockt `smb-handle` + `atomic-write` modulweit, um das Schreib-Gate der
  // Team-Sidecar zu pruefen (v4.57). Ohne Isolation gewinnt die zuerst
  // registrierte Fabrik einer anderen Datei — `readText` lieferte dann nicht
  // das gestellte `null`, und die Zusage „eine fehlende Datei leert den Cache"
  // fiel. Einzeln immer gruen.
  'src/core/spalten/__tests__/team-store.test.ts',
  'src/core/status/__tests__/byte-identitaet.test.ts',
  // Beide mocken die Share-Schicht des Journals; ohne Isolation greifen ihre
  // Mocks ineinander.
  'src/core/status/__tests__/journal-lauf.test.ts',
  'src/core/status/__tests__/journal-lesen.test.ts',
  // Mockt dieselbe Share-Schicht (`sidecar-datei`) wie die Journal-Tests — und
  // dazu `feature-flags`; der Nachlauf führt obendrein Sitzungs-Merker im Modul
  // und setzt den Katalog-Snapshot (die Phasen-Register aus byte-identitaet).
  'src/core/status/__tests__/katalog-nachlauf.test.ts',
  'src/core/status/__tests__/katalog-share.test.ts',
  'src/core/status/__tests__/katalog-store.test.ts',
  // Setzt dieselben Modul-Register wie byte-identitaet (Snapshot in
  // status-canonical.ts + status-wert-labels.ts) — die Klärfragen, weil
  // `bezeichnungsAbweichungen` liest, was die ANZEIGE liefert, und das hängt am
  // Snapshot: ohne Isolation entschiede die Ladereihenfolge über das Ergebnis.
  'src/core/status/__tests__/klaerfragen.test.ts',
  'src/core/status/__tests__/label-identitaet.test.ts',
  'src/core/status/__tests__/reconcile-store.test.ts',
  'src/core/status/__tests__/trigger-share.test.ts',
  // Mockt `search-corpus` + `orama-store` + `embedding-corpus` modulweit, um die
  // drei Such-Quellen einzeln zu prüfen (v4.64). Andere Dateien laden dieselben
  // Module vorher echt — ohne Isolation griff die Fabrik nicht und der Aufruf
  // landete in der echten IDB-Schicht. Einzeln immer grün.
  'src/plugins/antraege/__tests__/dokumenttreffer-ohne-optin.test.ts',
  'src/plugins/auslastung/__tests__/assign-verbund.test.ts',
  'src/plugins/auslastung/__tests__/auslastung-coldstart-guard.test.ts',
  'src/plugins/auslastung/__tests__/auslastung-crosstab-reload.test.ts',
  'src/plugins/auslastung/__tests__/freigeben-bulk.test.ts',
  'src/plugins/auslastung/__tests__/kuerzelmap-coldstart-guard.test.ts',
  'src/plugins/auslastung/__tests__/persist-debounce.test.ts',
  'src/plugins/auslastung/__tests__/reconcile-zuweisungen.test.ts',
  'src/plugins/auslastung/__tests__/verbund-aggregation-livecache.test.ts',
  // Mockt den halben CSV-Service + den Lock-Kern modulweit.
  'src/plugins/csv-sources-kuration/services/__tests__/auto-refresh-ein-lock.test.ts',
];

export default defineConfig({
  define: {
    __TEAMFLOW_CONFIG__: JSON.stringify({
      configVersion: 1,
      variant: 'development',
      build: { label: 'Test', outputFilename: 'test', browserTabTitle: 'Test' },
      data: { fixedDataSharePath: null, shareGeneration: 1, fixedCsvImportPfad: null, allowUserToChangePath: true, allowLocalFallback: true, demoDataBundled: false },
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
