/**
 * TeamFlow Build-Time-Config: Schema, Defaults, Validierung.
 *
 * Wird von `build-with-config.mjs` (Node) und `vite.config.ts` (Vite/Node)
 * importiert, und als Referenz von der Config-UI (Vanilla-JS, dort portiert
 * weil kein Bundler-Step).
 */

import { FAVICON_DEFAULT_COLOR } from './favicon.mjs';

export const CONFIG_SCHEMA_VERSION = 2;

/**
 * v3.0: Module, die per Zusatzpasswort gesperrt werden koennen.
 *
 * Muss mit `ModulSlot` in src/config/runtime-config.ts uebereinstimmen — die
 * Liste steht hier ein zweites Mal, weil dieses Script kein TypeScript importiert.
 * Ein Convention-Test haelt beide Seiten zusammen.
 */
export const MODUL_SLOTS = ['auslastung', 'kurator'];

/**
 * v3.0: Merge-Basis fuer BUILDS — bewusst NICHT `DEFAULT_CONFIG`.
 *
 * `DEFAULT_CONFIG` ist die Dev-Server-Config: dort ist vieles absichtlich AN
 * (devFixtures, kuratorMenus, anfragen, gutachten* …). Als Basis unter eine
 * Variant-Config gelegt wuerde sie diese Flags still einschalten — in `prod`
 * waeren das 14 Stueck. Die Build-Basis ist deshalb neutral: **alle Features aus,
 * restriktive Daten-Defaults, kein Passwort, kein local-Block.**
 *
 * Dadurch enthaelt eine Variant-Config nur noch, was sie vom Standard
 * UNTERSCHEIDET — und ein neu eingefuehrter Flag wirkt nirgends versehentlich,
 * sondern muss bewusst eingeschaltet werden.
 *
 * `variant` und `build` stehen bewusst NICHT drin: sie identifizieren die
 * Variante und muessen explizit bleiben, sonst erbte eine Config mit vergessenem
 * `outputFilename` still den Namen „teamflow".
 */
export function buildBasis() {
  const ausserFeatures = Object.fromEntries(
    Object.keys(DEFAULT_CONFIG.features).map(k => [k, false]),
  );
  return {
    configVersion: CONFIG_SCHEMA_VERSION,
    data: {
      fixedDataSharePath: null,
      expectedFolderName: null,
      shareGeneration: 1,
      fixedCsvImportPfad: null,
      allowUserToChangePath: false,
      allowLocalFallback: false,
      demoDataBundled: false,
    },
    personalFolder: { ...DEFAULT_CONFIG.personalFolder },
    features: ausserFeatures,
    menuLabels: { ...DEFAULT_CONFIG.menuLabels },
    ki: {
      localLlama: { ...DEFAULT_CONFIG.ki.localLlama },
      // OpenRouter ist in Produktiv-Varianten verboten (validateConfig) — der
      // neutrale Default ist deshalb „aus".
      openrouter: { enabled: false, allowedModels: [] },
    },
    branding: { ...DEFAULT_CONFIG.branding },
    scan: { ...DEFAULT_CONFIG.scan },
    dev: null,
    auth: null,
    moduleAuth: null,
    local: null,
  };
}

/**
 * Deep-Merge zweier Plain-Objekte. Override gewinnt; Sub-Objekte werden rekursiv
 * gemergt; Arrays werden ERSETZT (nicht concatenated), weil variant-spezifische
 * Listen wie `scan.file_extensions` sonst stillschweigend wachsen wuerden.
 *
 * **Null-Semantik**: `undefined` im Override bedeutet "nicht angegeben → Basis
 * behalten". `null` ist ein expliziter Override-Wert (eine Variante kann z.B.
 * `fixedDataSharePath: null` setzen, um den shared-Default zu deaktivieren).
 *
 * Wird von `build-with-config.mjs` (mergt `_shared.json` + Variant-Config) und
 * `vite.config.ts` (mergt `_shared.json` + DEFAULT_CONFIG fuer den Dev-Server)
 * mitgenutzt.
 */
export function deepMerge(base, override) {
  if (override === undefined) return base;
  if (base === undefined) return override;
  // null ist ein expliziter Override-Wert (z.B. "Pfad bewusst deaktivieren")
  if (override === null) return null;
  if (base === null) return override;
  if (typeof base !== 'object' || typeof override !== 'object') return override;
  if (Array.isArray(base) || Array.isArray(override)) return override;

  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (key === '_comment') continue;
    const baseVal = base[key];
    const overrideVal = override[key];
    if (
      baseVal && typeof baseVal === 'object' && !Array.isArray(baseVal) &&
      overrideVal && typeof overrideVal === 'object' && !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else {
      result[key] = overrideVal;
    }
  }
  return result;
}

/** Wird als Fallback verwendet, wenn kein `TEAMFLOW_CONFIG` gesetzt ist (dev server). */
export const DEFAULT_CONFIG = {
  configVersion: CONFIG_SCHEMA_VERSION,
  variant: 'custom',

  build: {
    label: 'TeamFlow',
    outputFilename: 'teamflow',
    browserTabTitle: 'TeamFlow',
    sidebarSubtitle: 'Verwaltung',
    faviconColor: FAVICON_DEFAULT_COLOR,
  },

  data: {
    fixedDataSharePath: null,
    /**
     * v2.0: erwarteter Ordner-Name beim Daten-Share-Picker (z.B.
     * 'teamflow-forschungsfoerderung'). Wenn gesetzt: WelcomeScreen prueft
     * handle.name gegen diesen Wert und verweigert den Pick bei Mismatch.
     */
    expectedFolderName: null,
    /**
     * v4.0: Generation des Ablageorts. Zieht der Daten-Share um, wird der Wert
     * zusammen mit `fixedDataSharePath` hochgezaehlt. Die App merkt sich die
     * zuletzt verbundene Generation in der IDB und erzwingt beim Start einen
     * Re-Pick, solange die gespeicherte kleiner ist — sonst schreibt eine
     * bestehende Installation still in den ALTEN Ordner weiter (FSAPI-Handles
     * haengen am Dateisystem-Objekt, nicht am Anzeigepfad).
     */
    shareGeneration: 1,
    /**
     * v4.0: Pfad des CSV-Import-Ordners (liegt AUSSERHALB des Daten-Shares und
     * zieht nicht mit um). Wird beim Verknuepfen nur ANGEZEIGT und ist kopierbar
     * — die File System Access API erlaubt keine programmatische Vorauswahl.
     */
    fixedCsvImportPfad: null,
    allowUserToChangePath: true,
    allowLocalFallback: false,
    demoDataBundled: false,
  },

  /**
   * v2.0: Persoenlicher Ordner (User-Home-Laufwerk) fuer profile.json,
   * einstellungen.json und Feedback-Outbox.
   */
  personalFolder: {
    subfolder: 'ZAH',
    required: false,
    promptAfterProfile: true,
    snapshotAgeWarningDays: 3,
    /**
     * v4.1: Wurzeln, unter denen die persoenlichen Ordner der Anwender liegen
     * (Slots `user-folders-root-<id>`). Org-weit invariant → gehoert nach
     * `_shared.json`. Leer = keine Wurzel konfiguriert; ein evtl. vorhandener
     * Alt-Slot `user-folders-root` bleibt trotzdem lesbar.
     * `id` ist Teil des Slot-Namens und muss stabil bleiben; `legacy` ist fuer
     * genau diesen Alt-Slot reserviert.
     */
    roots: [],
  },

  features: {
    kuratorMenus: true,
    dokumentenscan: false,
    devInfraPanel: true,
    devFixtures: true,
    // `dokumente` ist ein Phase-2-Platzhalter. Der Bereich „Förderanträge" hat
    // seit v3.0 keinen Flag mehr — er existiert in jeder Variante.
    dokumente: false,
    auslastung: false,
    /** v2.x: Schreibrecht auf den Daten-Share auch fuer Nicht-Kuratoren. Hebt
     *  das v2.0-read-only-Hardening (Pitfall #24) gezielt fuer Rollen auf, die
     *  aktiv in `_intern/*` schreiben muessen — konkret die PL (Auslastungs-
     *  Klassifizierung schreibt `auslastung.json`). Steuert Picker-/Grant-Mode
     *  (`canWriteDatenShare`). Nur in dev + pl true. */
    datenShareSchreibrecht: true,
    /** v2.11: Erzwingt beim App-Start eine MA-Login-Wall (nur Passwort). Das
     *  Bearbeiter-Kuerzel wird aus dem Passwort entschluesselt (gegen
     *  `_intern/auslastung-zugang.enc`), nicht mehr frei im Profil getippt —
     *  verhindert Fremd-Eintragen. Greift nur wenn die Zugangsdatei existiert
     *  (sonst Fallback aufs alte Kuerzelfeld). Nur prod (+ dev zum Testen). */
    maLogin: true,
    /** Dev-only: Löschen von Feedback-Tickets im Kurator-Dashboard (nach
     *  Bestätigung). Destruktiv — default false, nur dev true. */
    feedbackDelete: true,
    /** v2.18: CSV-Auto-Refresh-Banner + Datei-Picker auch ohne Kurator-Menüs
     *  (z.B. pl-Variante). Der Banner pollt registrierte CSV-Quellen auf neuere
     *  `lastModified`-Stände; in Nicht-Kurator-Builds kann die Quelldatei über
     *  einen schlanken Picker verknüpft werden (showOpenFilePicker →
     *  setCsvSourceHandle). Default false — opt-in pro Variante (pl + dev).
     *  Braucht `datenShareSchreibrecht` zum Schreiben des Snapshots. Der Kurator-
     *  Banner läuft unabhängig weiter über `kuratorMenus`. */
    csvAutoRefresh: false,
    /** v2.59: „Online"-Tab in den Einstellungen — zeigt zuletzt aktive Team-User
     *  aus den eingesammelten Heartbeats. Nur pl (+ dev zum Testen). Optional,
     *  default false. */
    onlineStatusTab: false,
    /** Gutachten-Testballon: KI-gestuetzte Kurzfassung auf der Foerderantrags-
     *  Detailseite (Dokumenten-Aufnahme → Skill → Review/Freigabe → DOCX-Vorlage).
     *  Erster „Mini-Agent" — dev + pl. Optional, default false
     *  (kein requiredFlags-Eintrag). */
    gutachtenKurzfassung: true,
    /** Gutachten-Workflow A–G: deterministischer Workflow-Runner über Registry-
     *  Skills (loest die Kurzfassung-Sektion ab). dev + pl + kurator. Optional,
     *  default false (kein requiredFlags-Eintrag). */
    gutachtenWorkflow: true,
    /** Workflow-Entwürfe sichtbar + ausführbar (freigabe:'entwurf'). dev + pl +
     *  kurator — in `production`-Varianten muss der Flag EXPLIZIT gesetzt werden
     *  (Default ist `?? variant === 'development'`).
     *  Optional, default false (kein requiredFlags-Eintrag). */
    workflowEntwuerfe: true,
    /** NF-Nachforderungen (Artefakt-Engine): Pro-TV-NF-Entwürfe auf der Verbund-
     *  Detailseite (Baustein-Auswahl/-Füllung → QS → DOCX + E-Mail-Entwurf).
     *  dev + pl. Optional, default false (kein requiredFlags-Eintrag). */
    nfNachforderungen: true,
    /** Artefakt-Werkbank: EIN Workspace auf der Verbund-Detailseite — offene Punkte
     *  erfassen/ankreuzen → Baustein-Vorschläge bestätigen → Entwurf (NF/RNE/ABL)
     *  über die bestehende NF-Maschine. Ersetzt bei aktivem Flag die
     *  NachforderungenSection. dev + pl — immer ZUSAMMEN mit `nfNachforderungen`
     *  setzen (sonst fehlt die NF-Karte der Artefakt-Leiste). Optional, default
     *  false (kein requiredFlags-Eintrag). */
    artefaktWerkbank: true,
    /** Antrag-Aufbereitung: Vollbild-Aufbereitung der VB (Gliederung + Tabellen-
     *  Ernte, Zeitplan-Gantt + Text↔Anlage-5-Plausibilität). Paket 1 rein
     *  deterministisch (kein LLM). dev + pl. Optional, default false
     *  (kein requiredFlags-Eintrag). */
    antragAufbereitung: true,
    /** Skill-Verwaltung: Kurator-pflegbare Skill-/Regel-Registry mit Sandbox-
     *  Testlauf. Sichtbar in dev + kurator + pl (Schreiben in pl über
     *  `datenShareSchreibrecht`, sonst Kurator-Session). Optional, default false
     *  (kein requiredFlags-Eintrag). */
    skillVerwaltung: true,
    /** Modul „Anfragen": E-Mail-Kurzanfrage (.msg) → interne Anonymisierung →
     *  Export in den externen ZIM FAQ-Assistenten → deterministische Wiedereinsetzung.
     *  Plugin-Flag, dev + pl + as + kurator. Optional, default false
     *  (kein requiredFlags-Eintrag → `=== true` Backward-Kompat). */
    anfragen: true,
    /** v2.97: Delta-Snapshots SCHREIBEN (nur geänderte antraege-Records
     *  publizieren). Default false (DEFAULT/dev-Server + Tests bleiben auf dem
     *  vollen v1-Write); in pl/kurator-Configs auf true. Der Leser versteht
     *  Deltas immer. Optional, kein requiredFlags-Eintrag. */
    deltaSnapshotWrite: false,
    /** Assistent Phase 0: gerätelokales, opt-in Ereignisprotokoll über
     *  app-semantische Aktionen (Fundament für den späteren persönlichen
     *  Assistenten — noch KEIN LLM/Chat/UI-Assistent). Gated den gesamten
     *  Phase-0-Umfang (Aufzeichnung + Einstellungs-Sektion). dev + pl + kurator + as;
     *  Freischaltung ≠ Aufzeichnung (bleibt opt-in + gerätelokal). Optional,
     *  default false (kein requiredFlags-Eintrag → `=== true` Backward-Kompat). */
    assistentProtokoll: false,
    /** Assistent Phase 1: kontextbewusstes Assistenz-Panel (deterministisch
     *  assemblierter Kontext + intern-only Transport, session-only Historie).
     *  dev + pl + kurator + as. Optional, default false (`=== true` Backward-Kompat). */
    assistentPanel: false,
    /** Assistent Phase 2: Gedächtnis-Konsolidierung (Sleep-time). Ein Hintergrund-
     *  lauf destilliert das Ereignisprotokoll per INTERNEM Modell in benannte
     *  Memory-Blocks, die transparent einsehbar/löschbar sind und in den Panel-
     *  Kontext einfließen. Doppeltes Opt-in (setzt Protokoll-Opt-in voraus).
     *  dev + pl + kurator + as; erfordert `assistentPanel` + `assistentProtokoll`
     *  (Regel in `validateConfig`). Optional, default false (`=== true` Backward-Kompat). */
    assistentGedaechtnis: false,
    /** MAP „Neuer Prüf-Workflow": Import von Plattform-Einreichungs-JSON per
     *  Drag & Drop, deterministische Rechenchecks und eine im Betrieb
     *  editierbare, versionierte Förderfähigkeits-Checkliste. Eigene Entität im
     *  kv-Store — greift NICHT in die CSV-/Antrags-Pipeline ein. dev + pl.
     *  Optional, default false (kein requiredFlags-Eintrag → `=== true`
     *  Backward-Kompat). */
    mapFoerderfaehig: false,
    /** Status-System neu: kuratierbarer Status-Katalog + append-only Historie +
     *  Ableitungs-Engine + Cockpit/Timeline/Widget. Gated die gesamte neue
     *  Schicht. dev/pl/kurator. Optional, default false (kein requiredFlags-
     *  Eintrag → `=== true` Backward-Kompat). */
    statusCockpit: false,
    /** Bearbeitungs-Meilensteine + Fristen-Monitoring: kuratierbarer Meilenstein-
     *  Plan (Soll-Wochen nach Antragseingang) + deterministische Bewertung
     *  erreicht/fällig/gerissen + Prognose zur 3-Monats-Gesamtfrist, plus Plugin,
     *  Home-Widget und Detailseiten-Sektion. dev/pl/as/kurator. Optional,
     *  default false (kein requiredFlags-Eintrag → `=== true` Backward-Kompat). */
    meilensteinMonitoring: false,
    /** Vorgangssystem: Status-Erklärung (Info-Icon), Kürzel-Glossar + Navigator,
     *  To-do-Board, Stillstands-Wächter und Fristen-Cockpit. Die App leitet
     *  dabei KEINEN Status ab — alles steht neben dem importierten Status.
     *  Setzt `statusCockpit` voraus (ohne Katalog keine Codes). dev/pl.
     *  Optional, default false (kein requiredFlags-Eintrag → `=== true`
     *  Backward-Kompat). */
    vorgangssystem: false,
    /** Eigene Spalten der Fördertabelle: der Nutzer legt Spalten an, die es in
     *  der Registry nicht gibt — ein rohes CSV-Feld, das jüngste Datum aus einer
     *  Feldmenge, oder eine Regelkaskade. Gated Picker-Fuß, Editor und die
     *  Projektion der referenzierten Rohfelder. dev/pl. Optional, default false
     *  (kein requiredFlags-Eintrag → `=== true` Backward-Kompat). */
    eigeneSpalten: false,
    /** Suche mit natürlicher Sprache: die interne KI übersetzt eine Frage in
     *  einen Frageplan (Leitbegriffe mit ihren Schreibweisen, Einschränkungen,
     *  Facetten), die Suchstufe läuft unverändert weiter. Die KI ist damit die
     *  Synonymquelle, die der Suche fehlt — sie kann Begriffe BENENNEN, und nur
     *  benennbare Begriffe lassen sich anzeigen und abwählen. Gated Umschalter,
     *  Frage-Beispiele und den KI-Lauf; ohne Plan verhält sich die Suche
     *  bitweise wie heute. Braucht die interne KI (Bridge). dev + pl. Optional,
     *  default false (kein requiredFlags-Eintrag → `=== true` Backward-Kompat). */
    sucheNatuerlicheSprache: false,
    /** Metadaten-Extraktion über eine frei konfigurierte API-Adresse: die
     *  Einträge „Interne KI-API" und „OpenRouter API" im Aufklappmenü der Seite
     *  „Suche & Index". Beide bauen ihren Transport aus dem `ai-provider`-Eintrag,
     *  den nur die dev-Provider-Klappe setzen kann — in pl steht dort die
     *  Streamlit-Adresse, gegen die ein OpenAI-kompatibler Ping scheitert. dev +
     *  local. Optional, default false (kein requiredFlags-Eintrag → `=== true`
     *  Backward-Kompat). */
    metadatenDirektApi: true,
  },

  menuLabels: {
    antraege: 'Förderanträge',
    dokumente: 'Dokumente',
  },

  dev: {
    defaultKuratorName: 'Dev',
    defaultKuratorPassword: 'dev',
    dataSharePath: null,
    sessionTtlDays: 30,
    autoRefreshSmbPermission: true,
    autoReloadAfterScenario: true,
  },

  ki: {
    localLlama: {
      enabled: true,
      endpoint: 'http://localhost:8081',
    },
    openrouter: {
      enabled: false,
      allowedModels: [],
    },
  },

  branding: {
    logoUrl: null,
    primaryColor: null,
  },

  // Phase 2 — Scan-Konfiguration. Wirkt nur, wenn features.dokumentenscan = true.
  scan: {
    sub_roots: [],            // relative Unterprogramm-Roots im dokumentenquelle-Handle
    file_extensions: [],      // z.B. ['.pdf', '.docx'] — Pflicht wenn dokumentenscan aktiv
    max_depth: 20,
    fkz_allowed_prefixes: [], // z.B. ['16EP', '16KN', '16DS', '16DL']
  },

  // v2.16: Build-Time Rollen-Passwort-Gate. null = keine Wall (Dev-Server +
  // Varianten ohne Gate). pl/kurator bekommen den auth-Block via
  // `npm run set-password -- <variant> <pw>` eingebacken (scripts/set-app-password.mjs).
  auth: null,

  // v3.0: Modul-Schloesser. null/leer = nichts gesperrt (Dev-Server, dev, prod).
  // Nur `pl` traegt Slots — via `npm run set-password -- pl --modul <slot> <pw>`.
  moduleAuth: null,

  // Variante „local" (nur Entwickler-Maschine, nur Dev-Server): feste lokale
  // Ordner statt File-System-Access-API-Picker. `null` = aus. Gesetzt wird der
  // Block ausschliesslich von configs/local.config.json; `scripts/dev-local.mjs`
  // startet damit den Vite-Dev-Server. Ein Build faltet den Zweig immer weg
  // (`__TEAMFLOW_LOCAL_FS__` haengt an `command === 'serve'`, vite.config.ts).
  // Siehe docs/architecture/local-variante.md.
  local: null,

  // Modul „Anfragen" (nur dev). Optionaler Per-Variant-Override der ZIM-FAQ-
  // Assistent-URL. Der kanonische Default lebt als EINZIGE Code-Quelle in
  // src/config/feature-flags.ts (DEFAULT_ANFRAGEN_DASHBOARD_URL); `null` = diesen
  // Default verwenden. Team-weite Laufzeit-Änderung: Kuration → Anfragen.
  anfragen: {
    dashboardUrl: null,
  },

  // Antrag-Aufbereitung (nur dev). Optionale Per-Variant-Overrides der Deep-Research-
  // Ziel-URLs; die kanonischen Defaults leben als EINZIGE Code-Quelle in
  // src/config/feature-flags.ts (DEFAULT_AUFBEREITUNG_*_URL). `null` = Default verwenden.
  aufbereitung: {
    chatgptUrl: null,
    claudeUrl: null,
    mistralUrl: null,
  },
};

/** Einzel-Pfad-Slots des `local`-Blocks (Variante „local"). */
const LOCAL_PFAD_SLOTS = ['datenShare', 'persoenlich', 'userFoldersRoot', 'csvSourceDir', 'vorlagenDir'];
/** Slot-Maps `{id: pfad}` des `local`-Blocks. */
const LOCAL_PFAD_MAPS = ['dmsSources', 'userFoldersRoots'];

/**
 * Absoluter Pfad? Akzeptiert Windows (`C:\…`, `C:/…`), UNC (`\\server\…`) und
 * POSIX (`/…`). Bewusst plattform-unabhaengig: diese Datei laeuft auch im
 * Browser-Kontext der Config-UI, `node:path` ist hier nicht verfuegbar.
 */
function istAbsoluterPfad(p) {
  return /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p);
}

/**
 * Validiert eine geladene Config. Gibt `errors`/`warnings`/`valid` zurück.
 * Keine Schema-Library, bewusst simpel und ohne Dependencies.
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    return { errors: ['Config ist kein Objekt'], warnings, valid: false };
  }

  if (config.configVersion !== CONFIG_SCHEMA_VERSION) {
    errors.push(
      `configVersion muss ${CONFIG_SCHEMA_VERSION} sein, ist ${config.configVersion}`,
    );
  }

  const allowedVariants = ['development', 'production', 'custom'];
  if (!allowedVariants.includes(config.variant)) {
    errors.push(
      `variant muss einer von ${allowedVariants.join(', ')} sein, ist "${config.variant}"`,
    );
  }

  const build = config.build ?? {};
  if (typeof build.label !== 'string' || !build.label.trim()) {
    errors.push('build.label ist Pflicht');
  }
  if (typeof build.outputFilename !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(build.outputFilename)) {
    errors.push('build.outputFilename darf nur a-z, A-Z, 0-9, - und _ enthalten');
  }
  if (typeof build.browserTabTitle !== 'string' || !build.browserTabTitle.trim()) {
    errors.push('build.browserTabTitle ist Pflicht');
  }
  if (build.sidebarSubtitle != null) {
    if (typeof build.sidebarSubtitle !== 'string' || !build.sidebarSubtitle.trim()) {
      errors.push('build.sidebarSubtitle muss nicht-leerer String oder weggelassen sein');
    }
  }
  if (build.outputSubdir != null) {
    if (typeof build.outputSubdir !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(build.outputSubdir)) {
      errors.push('build.outputSubdir muss leer oder a-z/A-Z/0-9/-/_ sein');
    }
  }
  if (build.faviconColor != null) {
    // Wird in das Favicon-SVG interpoliert (scripts/favicon.mjs) — hier hart
    // pruefen statt still auf den Default zurueckfallen zu lassen.
    if (typeof build.faviconColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(build.faviconColor)) {
      errors.push('build.faviconColor muss die Form #rrggbb haben (z.B. #506786)');
    }
  }

  const data = config.data ?? {};
  if (data.fixedDataSharePath != null && typeof data.fixedDataSharePath !== 'string') {
    errors.push('data.fixedDataSharePath muss string oder null sein');
  }
  if (data.expectedFolderName != null && typeof data.expectedFolderName !== 'string') {
    errors.push('data.expectedFolderName muss string oder null sein');
  }
  if (data.shareGeneration != null) {
    if (typeof data.shareGeneration !== 'number' || !Number.isInteger(data.shareGeneration) || data.shareGeneration < 1) {
      errors.push('data.shareGeneration muss eine ganze Zahl >= 1 sein');
    }
  }
  if (data.fixedCsvImportPfad != null && typeof data.fixedCsvImportPfad !== 'string') {
    errors.push('data.fixedCsvImportPfad muss string oder null sein');
  }
  if (data.fixedDataSharePath && data.allowUserToChangePath) {
    warnings.push(
      'Fester Pfad + User-Auswahl gleichzeitig aktiv: Nutzer kann den festen Pfad überschreiben',
    );
  }
  if (!data.fixedDataSharePath && !data.allowUserToChangePath && !data.allowLocalFallback) {
    errors.push(
      'App wäre unbenutzbar: kein fester Pfad, keine User-Auswahl, kein Lokal-Fallback',
    );
  }

  // v2.0: personalFolder strukturell pruefen (optional, default-getragen)
  const personalFolder = config.personalFolder ?? null;
  if (personalFolder !== null) {
    if (typeof personalFolder !== 'object' || Array.isArray(personalFolder)) {
      errors.push('personalFolder muss Objekt oder weggelassen sein');
    } else {
      if (typeof personalFolder.subfolder !== 'string' || !personalFolder.subfolder.trim()) {
        errors.push('personalFolder.subfolder muss nicht-leerer String sein');
      }
      if (typeof personalFolder.required !== 'boolean') {
        errors.push('personalFolder.required muss boolean sein');
      }
      if (typeof personalFolder.promptAfterProfile !== 'boolean') {
        errors.push('personalFolder.promptAfterProfile muss boolean sein');
      }
      if (typeof personalFolder.snapshotAgeWarningDays !== 'number' || personalFolder.snapshotAgeWarningDays < 0) {
        errors.push('personalFolder.snapshotAgeWarningDays muss Zahl >= 0 sein');
      }
      // v4.1: Wurzeln der persoenlichen Ordner. Die `id` wandert in den
      // Slot-Namen `user-folders-root-<id>` und damit in die IndexedDB — eine
      // Tippfehler-Korrektur spaeter wuerde jede Verknuepfung entwerten.
      // Deshalb hier hart pruefen statt still zu schlucken.
      if (personalFolder.roots != null) {
        if (!Array.isArray(personalFolder.roots)) {
          errors.push('personalFolder.roots muss ein Array sein');
        } else {
          const gesehen = new Set();
          for (const root of personalFolder.roots) {
            if (!root || typeof root !== 'object' || Array.isArray(root)) {
              errors.push('personalFolder.roots: jeder Eintrag muss ein Objekt { id, label } sein');
              continue;
            }
            if (typeof root.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(root.id)) {
              errors.push(`personalFolder.roots: id "${root.id}" muss a-z/0-9/- sein und mit a-z/0-9 beginnen`);
              continue;
            }
            if (root.id === 'legacy') {
              errors.push('personalFolder.roots: id "legacy" ist fuer den Alt-Slot reserviert');
            }
            if (typeof root.label !== 'string' || !root.label.trim()) {
              errors.push(`personalFolder.roots: label zu "${root.id}" muss nicht-leerer String sein`);
            }
            if (gesehen.has(root.id)) {
              errors.push(`personalFolder.roots: id "${root.id}" kommt doppelt vor`);
            }
            gesehen.add(root.id);
          }
        }
      }
    }
  }

  const features = config.features ?? {};
  // v3.0: Nur noch die sicherheits-/zugriffsrelevanten Flags muessen explizit in
  // JEDER Config stehen. Alles andere erbt aus DEFAULT_CONFIG (build-with-config
  // mergt sie als Basis) — eine Variant-Config enthaelt damit nur noch, was sie
  // vom Standard UNTERSCHEIDET. Das war die Ursache der as/pl-Drift: jede Config
  // wiederholte alles, und eine vergessene Zeile fiel niemandem auf.
  const requiredFlags = [
    'kuratorMenus', 'devFixtures', 'auslastung',
    'datenShareSchreibrecht', 'maLogin', 'dokumentenscan',
  ];
  for (const k of requiredFlags) {
    if (typeof features[k] !== 'boolean') {
      errors.push(`features.${k} muss boolean sein`);
    }
  }

  // Legacy-Warnung: forschung wurde mit v1.14 in antraege konsolidiert.
  if (Object.prototype.hasOwnProperty.call(features, 'forschung')) {
    warnings.push(
      'features.forschung wird ab v1.14 ignoriert — das Forschung-Plugin wurde in antraege konsolidiert.',
    );
  }

  // v3.0: Der frühere `features.antraege`-Zwang („muss aktiv sein") ist entfallen —
  // ein Flag, der nur einen Wert annehmen darf, ist keiner. Der Bereich existiert
  // jetzt unbedingt; geprüft wird stattdessen sein Menü-Label (siehe unten).

  // Die Assistent-Phasen bauen aufeinander auf: Phase 2 destilliert das Phase-0-
  // Protokoll (Quelle) und speist ausschliesslich den Phase-1-Panel-Kontext (Senke).
  // Ohne die Vorstufen liefe eine Konsolidierung, die niemand ausloesen und deren
  // Ergebnis niemand sehen koennte — die UI haengt in ProfilTab hinter dem
  // Protokoll-Gate, der Memory-Block hat ohne Panel keinen Leser.
  if (features.assistentGedaechtnis === true) {
    const fehlend = ['assistentPanel', 'assistentProtokoll'].filter(f => features[f] !== true);
    if (fehlend.length > 0) {
      errors.push(
        `features.assistentGedaechtnis = true erfordert ${fehlend.map(f => `features.${f} = true`).join(' und ')}`,
      );
    }
  }

  // menuLabels: für jedes aktive Bereichs-Menü muss ein nicht-leerer Label-String gesetzt sein.
  const menuLabels = config.menuLabels ?? {};
  if (typeof menuLabels !== 'object' || Array.isArray(menuLabels)) {
    errors.push('menuLabels muss Objekt sein');
  } else {
    // `antraege` hat seit v3.0 keinen Flag mehr (der Bereich ist in jeder Variante
    // da) — sein Label ist deshalb UNBEDINGT Pflicht, nicht flag-abhaengig.
    if (typeof menuLabels.antraege !== 'string' || !menuLabels.antraege.trim()) {
      errors.push('menuLabels.antraege muss ein nicht-leerer String sein (der Bereich existiert in jeder Variante)');
    }
    {
      const key = 'dokumente';
      const flagActive = features[key] === true;
      const label = menuLabels[key];
      if (flagActive) {
        if (typeof label !== 'string' || !label.trim()) {
          errors.push(`menuLabels.${key} muss nicht-leerer String sein, wenn features.${key}=true`);
        }
      } else if (label != null && typeof label !== 'string') {
        errors.push(`menuLabels.${key} muss string oder weggelassen sein`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(menuLabels, 'forschung')) {
      warnings.push(
        'menuLabels.forschung wird ab v1.14 ignoriert — das Forschung-Plugin wurde in antraege konsolidiert.',
      );
    }
  }

  // Dev-Fixtures strukturell nur in development erlaubt.
  if (features.devFixtures === true && config.variant === 'production') {
    errors.push(
      'KRITISCH: features.devFixtures darf nicht in variant=production aktiv sein. ' +
      'Fixtures enthalten destruktive Operationen (resetAll, programmatischer Import) und sensible Defaults.',
    );
  }
  const dev = config.dev ?? null;
  if (dev !== null) {
    if (typeof dev !== 'object') {
      errors.push('dev muss Objekt oder weggelassen sein');
    } else {
      if (dev.defaultKuratorName != null && typeof dev.defaultKuratorName !== 'string') {
        errors.push('dev.defaultKuratorName muss string oder null sein');
      }
      if (dev.defaultKuratorPassword != null && typeof dev.defaultKuratorPassword !== 'string') {
        errors.push('dev.defaultKuratorPassword muss string oder null sein');
      }
      if (dev.dataSharePath != null && typeof dev.dataSharePath !== 'string') {
        errors.push('dev.dataSharePath muss string oder null sein');
      }
      if (dev.sessionTtlDays != null && (typeof dev.sessionTtlDays !== 'number' || dev.sessionTtlDays <= 0)) {
        errors.push('dev.sessionTtlDays muss positive Zahl oder weggelassen sein');
      }
      if (dev.autoRefreshSmbPermission != null && typeof dev.autoRefreshSmbPermission !== 'boolean') {
        errors.push('dev.autoRefreshSmbPermission muss boolean oder weggelassen sein');
      }
      if (dev.autoReloadAfterScenario != null && typeof dev.autoReloadAfterScenario !== 'boolean') {
        errors.push('dev.autoReloadAfterScenario muss boolean oder weggelassen sein');
      }
    }
  }

  const ki = config.ki ?? {};
  const openrouter = ki.openrouter ?? {};
  const localLlama = ki.localLlama ?? {};
  if (typeof openrouter.enabled !== 'boolean') errors.push('ki.openrouter.enabled muss boolean sein');
  if (typeof localLlama.enabled !== 'boolean') errors.push('ki.localLlama.enabled muss boolean sein');
  if (!openrouter.enabled && !localLlama.enabled) {
    warnings.push('Weder OpenRouter noch lokales Llama aktiv — KI-Funktionen stehen nicht zur Verfügung');
  }

  // Sicherheits-Kritischer Check (Kern des Patch-Ziels).
  if (openrouter.enabled && data.fixedDataSharePath && config.variant === 'production') {
    errors.push(
      'KRITISCH: OpenRouter aktiv + fester Daten-Pfad + variant=production. ' +
      'Echte Daten würden an Cloud-API gesendet. OpenRouter in dieser Variante ausschalten.',
    );
  }

  // Prod-Varianten dürfen keine synthetischen Demo-Daten bundeln.
  if (config.variant === 'production' && data.demoDataBundled === true) {
    errors.push(
      'KRITISCH: variant=production + demoDataBundled=true ist nicht erlaubt. ' +
      'Prod-Varianten dürfen keine synthetischen Demo-Daten bundeln.',
    );
  }

  // Feature-Widersprüche.
  if (features.kuratorMenus === false && data.fixedDataSharePath) {
    warnings.push(
      'Kurator-Menüs deaktiviert, aber fester Daten-Pfad konfiguriert: wer importiert dann Daten?',
    );
  }
  // v2.11: Die PL-Passwort-Erzeugung schreibt `_intern/auslastung-zugang.enc` —
  // braucht Schreibrecht auf dem Daten-Share, sonst wirft die Aktion NotAllowedError.
  // v3.0: Der eigene Flag ist entfallen, die Funktion haengt jetzt am Modul selbst.
  if (features.auslastung === true && features.datenShareSchreibrecht !== true) {
    warnings.push(
      'features.auslastung=true ohne datenShareSchreibrecht: die PL kann weder die Klassifizierung noch die Zugangsdatei schreiben (NotAllowedError).',
    );
  }
  // v2.18: CSV-Auto-Refresh (pl-Banner) schreibt beim Aktualisieren den Snapshot
  // auf den Daten-Share — braucht Schreibrecht (in Nicht-Kurator-Builds via
  // datenShareSchreibrecht), sonst wirft die Pipeline NotAllowedError. Im
  // Kurator-Build deckt die Kurator-Session das Schreibrecht ab.
  if (features.csvAutoRefresh === true && features.datenShareSchreibrecht !== true && features.kuratorMenus !== true) {
    warnings.push(
      'features.csvAutoRefresh=true ohne datenShareSchreibrecht (und ohne kuratorMenus): das Aktualisieren kann den Snapshot nicht schreiben (NotAllowedError).',
    );
  }
  // v2.16: Build-Time Rollen-Passwort-Gate (auth-Block) strukturell prüfen.
  const auth = config.auth ?? null;
  if (auth !== null) {
    if (typeof auth !== 'object' || Array.isArray(auth)) {
      errors.push('auth muss Objekt oder null/weggelassen sein');
    } else {
      if (typeof auth.required !== 'boolean') {
        errors.push('auth.required muss boolean sein');
      }
      if (auth.required === true) {
        if (typeof auth.salt !== 'string' || !auth.salt.trim()) {
          errors.push(
            'KRITISCH: auth.required=true aber auth.salt ist leer — das Gate ist nicht verifizierbar (App wäre ausgesperrt). ' +
            'Passwort via `npm run set-password -- <variant> <passwort>` setzen.',
          );
        }
        if (typeof auth.verifier !== 'string' || !auth.verifier.trim()) {
          errors.push(
            'KRITISCH: auth.required=true aber auth.verifier ist leer — das Gate ist nicht verifizierbar (App wäre ausgesperrt). ' +
            'Passwort via `npm run set-password -- <variant> <passwort>` setzen.',
          );
        }
      }
      if (auth.hint != null && typeof auth.hint !== 'string') {
        errors.push('auth.hint muss string oder weggelassen sein');
      }
    }
  }

  // v3.0: Modul-Schlösser (moduleAuth) — Zusatzpasswörter für einzelne Module.
  // Leitregel: VORHANDENER Slot = gesperrt, fehlender Slot = offen.
  const moduleAuth = config.moduleAuth ?? null;
  if (moduleAuth !== null) {
    if (typeof moduleAuth !== 'object' || Array.isArray(moduleAuth)) {
      errors.push('moduleAuth muss Objekt oder null/weggelassen sein');
    } else {
      for (const [slot, eintrag] of Object.entries(moduleAuth)) {
        // `_comment` ist die Konfig-Konvention dieses Repos (siehe _shared.json).
        if (slot.startsWith('_')) continue;
        // Ein Tippfehler im Slot-Namen hieße sonst GAR KEINE Sperre — ein stiller
        // Rückbau des Schutzes. Deshalb hart, nicht als Warnung.
        if (!MODUL_SLOTS.includes(slot)) {
          errors.push(
            `KRITISCH: moduleAuth.${slot} ist kein bekanntes Modul (erlaubt: ${MODUL_SLOTS.join(', ')}). ` +
            'Ein Tippfehler würde das Modul unbemerkt UNGESPERRT lassen.',
          );
          continue;
        }
        if (typeof eintrag !== 'object' || eintrag === null || Array.isArray(eintrag)) {
          errors.push(`moduleAuth.${slot} muss ein Objekt sein`);
          continue;
        }
        if (typeof eintrag.salt !== 'string' || !eintrag.salt.trim()) {
          errors.push(
            `KRITISCH: moduleAuth.${slot}.salt ist leer — das Schloss ist nicht verifizierbar. ` +
            `Passwort via \`npm run set-password -- <variant> --modul ${slot} <passwort>\` setzen.`,
          );
        }
        if (typeof eintrag.verifier !== 'string' || !eintrag.verifier.trim()) {
          errors.push(
            `KRITISCH: moduleAuth.${slot}.verifier ist leer — das Schloss ist nicht verifizierbar. ` +
            `Passwort via \`npm run set-password -- <variant> --modul ${slot} <passwort>\` setzen.`,
          );
        }
        if (eintrag.hint != null && typeof eintrag.hint !== 'string') {
          errors.push(`moduleAuth.${slot}.hint muss string oder weggelassen sein`);
        }
      }

      // Ein Schloss vor einem Modul, das gar nicht mitgebaut wird, ist tote Konfig.
      if (moduleAuth.auslastung && config.features?.auslastung !== true) {
        errors.push(
          'KRITISCH: moduleAuth.auslastung gesetzt, aber features.auslastung ist nicht true — ' +
          'das Modul ist gar nicht einkompiliert, die Sperre liefe ins Leere.',
        );
      }
      if (moduleAuth.kurator && config.features?.kuratorMenus !== true) {
        errors.push(
          'KRITISCH: moduleAuth.kurator gesetzt, aber features.kuratorMenus ist nicht true — ' +
          'die Kuration-Plugins werden schon zur Bauzeit entfernt, kein Passwort holt sie zurück.',
        );
      }

      // Geteilte Salts wären ein Copy-Paste-Fehler: ein Passwort öffnete zwei Türen.
      const salts = [
        ...(auth?.salt ? [['auth', auth.salt]] : []),
        ...Object.entries(moduleAuth)
          .filter(([, e]) => e && typeof e === 'object' && typeof e.salt === 'string')
          .map(([slot, e]) => [`moduleAuth.${slot}`, e.salt]),
      ];
      const gesehen = new Map();
      for (const [wo, salt] of salts) {
        if (gesehen.has(salt)) {
          warnings.push(
            `${wo} und ${gesehen.get(salt)} teilen sich dasselbe Salt — vermutlich ein Copy-Paste-Fehler ` +
            '(ein Passwort würde beide Türen öffnen).',
          );
        } else {
          gesehen.set(salt, wo);
        }
      }
    }
  }

  // Variante „local" (feste Entwickler-Ordner statt FSAPI-Picker) strukturell prüfen.
  const local = config.local ?? null;
  if (local !== null) {
    if (typeof local !== 'object' || Array.isArray(local)) {
      errors.push('local muss Objekt oder null/weggelassen sein');
    } else {
      if (config.variant === 'production') {
        errors.push(
          'KRITISCH: der local-Block darf nicht in einer variant="production"-Config stehen. ' +
          'Er verdrahtet feste Entwickler-Pfade und haengt den Ordner-Picker aus — ' +
          'in einer ausgelieferten Variante waere das ein Datenleck-Pfad.',
        );
      }
      for (const key of LOCAL_PFAD_SLOTS) {
        const wert = local[key];
        if (wert == null) continue;
        if (typeof wert !== 'string' || !wert.trim()) {
          errors.push(`local.${key} muss ein nicht-leerer Pfad-String oder null sein`);
        } else if (!istAbsoluterPfad(wert)) {
          errors.push(`local.${key} muss ein ABSOLUTER Pfad sein (ist "${wert}")`);
        } else if (wert.includes('..')) {
          errors.push(`local.${key} darf kein ".." enthalten (ist "${wert}")`);
        }
      }
      for (const key of LOCAL_PFAD_MAPS) {
        const map = local[key];
        if (map == null) continue;
        if (typeof map !== 'object' || Array.isArray(map)) {
          errors.push(`local.${key} muss ein Objekt {id: pfad} oder weggelassen sein`);
          continue;
        }
        for (const [id, wert] of Object.entries(map)) {
          if (typeof wert !== 'string' || !istAbsoluterPfad(wert) || wert.includes('..')) {
            errors.push(`local.${key}["${id}"] muss ein absoluter Pfad ohne ".." sein`);
          }
        }
      }
      if (local.profil != null) {
        if (typeof local.profil !== 'object' || Array.isArray(local.profil)) {
          errors.push('local.profil muss Objekt oder weggelassen sein');
        } else if (typeof local.profil.name !== 'string' || !local.profil.name.trim()) {
          errors.push('local.profil.name ist Pflicht, wenn local.profil gesetzt ist');
        }
      }
      if (local.datenShare == null) {
        warnings.push(
          'local-Block ohne local.datenShare: die App startet ohne Daten-Share-Handle und landet im Welcome-Screen.',
        );
      }
      if (features.devFixtures !== true) {
        warnings.push(
          'local-Block ohne features.devFixtures=true: der window.__tf-Steuerhook steht nicht zur Verfuegung.',
        );
      }
      if (config.ki?.openrouter?.enabled === true) {
        warnings.push(
          'local-Block + OpenRouter aktiv: die lokale Share-Kopie enthaelt ECHTE Daten, die so an eine Cloud-API gehen koennten.',
        );
      }
    }
  }

  // Phase-2-Scan-Config strukturell prüfen
  const scan = config.scan ?? null;
  if (scan !== null) {
    if (typeof scan !== 'object' || Array.isArray(scan)) {
      errors.push('scan muss Objekt oder weggelassen sein');
    } else {
      if (scan.sub_roots != null && (!Array.isArray(scan.sub_roots) || scan.sub_roots.some(s => typeof s !== 'string'))) {
        errors.push('scan.sub_roots muss string[] oder weggelassen sein');
      }
      if (scan.file_extensions != null && (!Array.isArray(scan.file_extensions) || scan.file_extensions.some(s => typeof s !== 'string'))) {
        errors.push('scan.file_extensions muss string[] oder weggelassen sein');
      }
      if (scan.max_depth != null && (typeof scan.max_depth !== 'number' || scan.max_depth <= 0 || scan.max_depth > 50)) {
        errors.push('scan.max_depth muss positive Zahl <= 50 oder weggelassen sein');
      }
      if (scan.fkz_allowed_prefixes != null) {
        if (!Array.isArray(scan.fkz_allowed_prefixes)) {
          errors.push('scan.fkz_allowed_prefixes muss string[] oder weggelassen sein');
        } else {
          for (const p of scan.fkz_allowed_prefixes) {
            if (typeof p !== 'string' || !/^\d{2}[A-Z]{2}$/.test(p)) {
              errors.push(`scan.fkz_allowed_prefixes: "${p}" ist kein gültiges Präfix (Format: 2 Ziffern + 2 Großbuchstaben, z.B. "16KN")`);
            }
          }
        }
      }
    }
  }

  // Wenn dokumentenscan aktiv ist, müssen file_extensions gesetzt sein.
  if (features.dokumentenscan === true) {
    const ext = scan?.file_extensions;
    if (!Array.isArray(ext) || ext.length === 0) {
      errors.push(
        'features.dokumentenscan = true erfordert scan.file_extensions als nicht-leeres Array (z.B. [".pdf", ".docx"]).',
      );
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}
