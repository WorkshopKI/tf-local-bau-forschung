/**
 * TeamFlow Build-Time-Config: Schema, Defaults, Validierung.
 *
 * Wird von `build-with-config.mjs` (Node) und `vite.config.ts` (Vite/Node)
 * importiert, und als Referenz von der Config-UI (Vanilla-JS, dort portiert
 * weil kein Bundler-Step).
 */

export const CONFIG_SCHEMA_VERSION = 2;

/**
 * Deep-Merge zweier Plain-Objekte. Override gewinnt; Sub-Objekte werden rekursiv
 * gemergt; Arrays werden ERSETZT (nicht concatenated), weil variant-spezifische
 * Listen wie `scan.file_extensions` sonst stillschweigend wachsen wuerden.
 *
 * **Null-Semantik**: `undefined` im Override bedeutet "nicht angegeben → Basis
 * behalten". `null` ist ein expliziter Override-Wert (z.B. demo.config.json
 * setzt `fixedDataSharePath: null` um den shared-Default zu deaktivieren).
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
  },

  data: {
    fixedDataSharePath: null,
    /**
     * v2.0: erwarteter Ordner-Name beim Daten-Share-Picker (z.B.
     * 'teamflow-forschungsfoerderung'). Wenn gesetzt: WelcomeScreen prueft
     * handle.name gegen diesen Wert und verweigert den Pick bei Mismatch.
     */
    expectedFolderName: null,
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
  },

  features: {
    kuratorMenus: true,
    /** v2.10: Erzwingt beim App-Start einen Kurator-Login (Passwort-Wall) und
     *  schaltet danach is_kurator (Menüs) + Schreib-Session frei. Nur in der
     *  kurator-Variante true. dev bleibt false (Auto-Kurator via Fixtures). */
    requireKuratorLogin: false,
    feedback: true,
    dokumentenscan: false,
    volltextsuche: true,
    devInfraPanel: true,
    devFixtures: true,
    // Bereichs-Menüs: mindestens eines der beiden (antraege/bauantraege) muss aktiv sein.
    // Bauantraege sind synthetische Demo-Daten — nur die `demo`-Variante aktiviert
    // sie. In dev/prod/kurator/pl bleibt das Flag aus, damit weder das Plugin,
    // noch die Department-Auswahl, noch die Seeds erscheinen.
    antraege: true,
    bauantraege: false,
    dokumente: false,
    auslastung: false,
    /** Selbsteintragungs-Sektion + Banner auf der Homepage. Im Gegensatz zu
     *  `auslastung` (volles PL-Plugin in der Sidebar) ist das ein
     *  End-User-Feature: jeder Bearbeiter mit gesetztem Kuerzel sieht
     *  passende Antraege seiner Hauptkategorie auf der Home. Default false,
     *  damit prod-Builds das Feature explizit aktivieren. */
    auslastungSelbstEintragung: false,
    /** v2.5: Klartext-Anzeige der TIB-Kuerzel im Auslastungs-Modul, nach
     *  Passwort-Eingabe freischaltbar (24h-Session). Nur in dev + pl
     *  Varianten aktiviert, die auf einem geschuetzten SMB-Bereich liegen
     *  und nur von der PL aufgerufen werden. */
    deAnonymisierung: false,
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
    /** v2.11: PL-Funktion „Zugangspasswort generieren" in der MA-Verwaltung —
     *  verschluesselt das echte Kuerzel unter einem generierten 2-Wort-Passwort
     *  und schreibt den Eintrag in `_intern/auslastung-zugang.enc`. Braucht
     *  `datenShareSchreibrecht` + `deAnonymisierung`. Nur pl (+ dev zum Testen). */
    maVerwaltungPasswort: true,
    // User-Plugin-Gates: getrennt von den Master-Flags volltextsuche/feedback,
    // damit Varianten den Kurator-Index/Feedback-Verwaltung freischalten können,
    // ohne dass das User-Suche-Plugin oder das User-Feedback-Board in der
    // Sidebar erscheint (vgl. kurator-Variante: Kuration nach Login, aber
    // Standard-Sidebar bleibt schmal).
    chat: true,
    suche: true,
    feedbackBoard: true,
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
    /** v2.47: Lokaler Themenkorpus-Build erlaubt (Embedding-Modell ~200 MB im
     *  RAM). In geteilten Citrix-pl-Sitzungen auf false → Build-Buttons aus,
     *  nur Download. Optional (kein requiredFlags-Eintrag) — fehlt = erlaubt. */
    embeddingCorpusBuild: true,
    /** v2.56: Auslastungs-Modul auf reine Themen-Vektoren-Korpus-Pflege
     *  beschränken (kurator-Variante). Modul ist aktiv (features.auslastung),
     *  aber nur der schlanke Korpus-View erscheint — keine MA-Auslastung-/
     *  Zuweisung-/Kompetenz-Tabs, keine MA-mutierenden Hooks. Default false
     *  (optional, kein requiredFlags-Eintrag). */
    auslastungNurKorpus: false,
    /** v2.59: Hintergrund-Heartbeat-Writer (jede Variante). Schreibt periodisch
     *  `ZAH/online-status.json` in den persoenlichen Ordner, solange die App
     *  offen ist — Quelle fuer den PL-„Online"-Tab. Optional (kein
     *  requiredFlags-Eintrag), default true → ueberall an. */
    presenceHeartbeat: true,
    /** v2.59: „Online"-Tab in den Einstellungen — zeigt zuletzt aktive Team-User
     *  aus den eingesammelten Heartbeats. Nur pl (+ dev zum Testen). Optional,
     *  default false. */
    onlineStatusTab: false,
  },

  menuLabels: {
    antraege: 'Förderanträge',
    bauantraege: 'Bauanträge',
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
};

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

  const allowedVariants = ['development', 'demo', 'production', 'custom'];
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

  const data = config.data ?? {};
  if (data.fixedDataSharePath != null && typeof data.fixedDataSharePath !== 'string') {
    errors.push('data.fixedDataSharePath muss string oder null sein');
  }
  if (data.expectedFolderName != null && typeof data.expectedFolderName !== 'string') {
    errors.push('data.expectedFolderName muss string oder null sein');
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
    }
  }

  const features = config.features ?? {};
  const requiredFlags = [
    'kuratorMenus', 'requireKuratorLogin', 'feedback', 'dokumentenscan', 'volltextsuche', 'devInfraPanel', 'devFixtures',
    'antraege', 'bauantraege', 'dokumente', 'auslastung', 'auslastungSelbstEintragung',
    'deAnonymisierung', 'datenShareSchreibrecht',
    'maLogin', 'maVerwaltungPasswort',
    'chat', 'suche', 'feedbackBoard',
    'csvAutoRefresh',
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

  // Mindestens ein Bereichs-Menü muss aktiv sein (antraege | bauantraege).
  // `dokumente` zählt nicht — reiner Phase-2-Platzhalter.
  const anyAreaMenuActive = !!(features.antraege || features.bauantraege);
  if (!anyAreaMenuActive) {
    errors.push(
      'Mindestens eines der Bereichs-Menüs muss aktiv sein (features.antraege oder features.bauantraege).',
    );
  }

  // menuLabels: für jedes aktive Bereichs-Menü muss ein nicht-leerer Label-String gesetzt sein.
  const menuLabels = config.menuLabels ?? {};
  if (typeof menuLabels !== 'object' || Array.isArray(menuLabels)) {
    errors.push('menuLabels muss Objekt sein');
  } else {
    const labelKeys = ['antraege', 'bauantraege', 'dokumente'];
    for (const key of labelKeys) {
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
  if (features.devFixtures === true && config.variant === 'demo') {
    errors.push(
      'KRITISCH: features.devFixtures darf nicht in variant=demo aktiv sein. ' +
      'Fixtures enthalten destruktive Operationen und sensible Defaults.',
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
      'Echte Daten würden an Cloud-API gesendet. Entweder OpenRouter ausschalten ' +
      'oder variant=demo setzen (synthetische Daten-Annahme).',
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
  if (features.feedback === false && features.kuratorMenus === true) {
    warnings.push(
      'Feedback-System aus, Kurator-Menüs aber an: Feedback-Verwaltung/-Board im Kurator-UI wird nicht sichtbar sein',
    );
  }
  // v2.11: PL-Passwort-Erzeugung schreibt `_intern/auslastung-zugang.enc` —
  // braucht Schreibrecht auf dem Daten-Share, sonst wirft die Aktion NotAllowedError.
  if (features.maVerwaltungPasswort === true && features.datenShareSchreibrecht !== true) {
    warnings.push(
      'features.maVerwaltungPasswort=true ohne datenShareSchreibrecht: die PL kann die Zugangsdatei nicht schreiben (NotAllowedError beim Passwort-Generieren).',
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
  // v2.11: maLogin (MA-Login-Wall) und requireKuratorLogin (Kurator-Wall) würden
  // beide eine Startup-Login-Wall erzwingen — der Kurator-Gate gewinnt (App.tsx),
  // die MA-Wall käme nie. In der Praxis schließen sich die Varianten aus.
  if (features.maLogin === true && features.requireKuratorLogin === true) {
    warnings.push(
      'features.maLogin und features.requireKuratorLogin gleichzeitig true: nur die Kurator-Login-Wall greift, die MA-Login-Wall wird übersprungen.',
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

  // v2.16: requireKuratorLogin ist durch das build-time auth-Gate abgelöst.
  if (features.requireKuratorLogin === true && auth?.required !== true) {
    warnings.push(
      'features.requireKuratorLogin=true ohne auth.required: das alte SMB-basierte Kurator-Gate (v2.10) greift, nicht das neue build-time Gate. ' +
      'Auf das auth-Gate migrieren: `npm run set-password -- kurator <pw>` + requireKuratorLogin=false.',
    );
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
