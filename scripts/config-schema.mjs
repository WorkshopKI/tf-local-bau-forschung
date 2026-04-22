/**
 * TeamFlow Build-Time-Config: Schema, Defaults, Validierung.
 *
 * Wird von `build-with-config.mjs` (Node) und `vite.config.ts` (Vite/Node)
 * importiert, und als Referenz von der Config-UI (Vanilla-JS, dort portiert
 * weil kein Bundler-Step).
 */

export const CONFIG_SCHEMA_VERSION = 1;

/** Wird als Fallback verwendet, wenn kein `TEAMFLOW_CONFIG` gesetzt ist (dev server). */
export const DEFAULT_CONFIG = {
  configVersion: CONFIG_SCHEMA_VERSION,
  variant: 'custom',

  build: {
    label: 'TeamFlow',
    outputFilename: 'teamflow',
    browserTabTitle: 'TeamFlow',
  },

  data: {
    fixedDataSharePath: null,
    allowUserToChangePath: true,
    allowLocalFallback: false,
    demoDataBundled: false,
  },

  features: {
    kuratorMenus: true,
    feedback: true,
    dokumentenscan: false,
    volltextsuche: true,
    devInfraPanel: true,
    devFixtures: true,
    // Bereichs-Menüs: mindestens eines der beiden (antraege/bauantraege) muss aktiv sein.
    antraege: true,
    bauantraege: true,
    dokumente: false,
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

  const data = config.data ?? {};
  if (data.fixedDataSharePath != null && typeof data.fixedDataSharePath !== 'string') {
    errors.push('data.fixedDataSharePath muss string oder null sein');
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

  const features = config.features ?? {};
  const requiredFlags = [
    'kuratorMenus', 'feedback', 'dokumentenscan', 'volltextsuche', 'devInfraPanel', 'devFixtures',
    'antraege', 'bauantraege', 'dokumente',
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

  return { errors, warnings, valid: errors.length === 0 };
}
