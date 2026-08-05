#!/usr/bin/env node
/**
 * TeamFlow Dev-Server-Orchestrator für die Variante „local".
 *
 * Spiegelt `build-with-config.mjs` (mergen → validieren → `TEAMFLOW_CONFIG`
 * setzen), startet aber den Vite-DEV-Server statt eines Builds. Der Dev-Server
 * ist Pflicht: die feste-Ordner-Brücke braucht einen Node-Prozess, unter
 * `file://` gibt es keinen Weg zu absoluten Pfaden ohne Ordner-Picker.
 *
 * Aufruf:
 *   node scripts/dev-local.mjs --config configs/local.config.json [-- <vite-args>]
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateConfig, deepMerge, buildBasis } from './config-schema.mjs';

const SHARED_CONFIG_PATH = resolve('configs/_shared.json');

function parseArgs(argv) {
  const args = argv.slice(2);
  const idx = args.indexOf('--config');
  if (idx === -1 || !args[idx + 1]) {
    console.error('Usage: node scripts/dev-local.mjs --config <config-file> [--port <n>]');
    process.exit(1);
  }
  const portIdx = args.indexOf('--port');
  const port = portIdx === -1 ? 5175 : Number(args[portIdx + 1]);
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`❌ Ungültiger Port: ${args[portIdx + 1]}`);
    process.exit(1);
  }
  return { configPath: args[idx + 1], port };
}

function loadJson(pfad, label) {
  if (!existsSync(pfad)) return null;
  try {
    return JSON.parse(readFileSync(pfad, 'utf-8'));
  } catch (err) {
    console.error(`❌ ${label} ist kein gültiges JSON: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Prüft, dass jeder konfigurierte Ordner wirklich existiert. Ein Tippfehler im
 * Pfad äußerte sich sonst erst viel später als leerer Bildschirm oder als
 * `NotFoundError` mitten im Startup — hier ist er sofort sichtbar.
 */
function pruefeOrdner(local) {
  const eintraege = [];
  for (const [key, wert] of Object.entries(local ?? {})) {
    if (typeof wert === 'string') {
      eintraege.push([key, wert]);
    } else if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
      for (const [id, inner] of Object.entries(wert)) {
        if (typeof inner === 'string') eintraege.push([`${key}.${id}`, inner]);
      }
    }
  }

  const fehlend = [];
  for (const [key, pfad] of eintraege) {
    // `profil.name` ist ein String, aber kein Pfad — nur absolute Pfade prüfen.
    if (!/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(pfad)) continue;
    if (!existsSync(pfad) || !statSync(pfad).isDirectory()) {
      fehlend.push(`local.${key} → ${pfad}`);
    }
  }
  return fehlend;
}

async function main() {
  const { configPath, port } = parseArgs(process.argv);
  const variantConfig = loadJson(resolve(configPath), configPath);
  if (!variantConfig) {
    console.error(`❌ Config-Datei nicht gefunden: ${resolve(configPath)}`);
    process.exit(1);
  }
  const sharedConfig = loadJson(SHARED_CONFIG_PATH, 'configs/_shared.json');
  // v3.0: dieselbe neutrale Basis wie `build-with-config.mjs` — sonst drifted
  // ausgerechnet die Abnahme-Umgebung von dem ab, was gebaut wird.
  const basis = sharedConfig ? deepMerge(buildBasis(), sharedConfig) : buildBasis();
  const config = deepMerge(basis, variantConfig);

  const { errors, warnings, valid } = validateConfig(config);
  if (warnings.length > 0) {
    console.warn('⚠  Config-Warnungen:');
    for (const w of warnings) console.warn('   • ' + w);
  }
  if (!valid) {
    console.error('❌ Config-Fehler, Start abgebrochen:');
    for (const e of errors) console.error('   • ' + e);
    process.exit(1);
  }

  if (!config.local) {
    console.error(
      '❌ Diese Config hat keinen `local`-Block — ohne ihn ist dev:local identisch zu `npm run dev`.\n' +
      '   Für den normalen Dev-Server: npm run dev',
    );
    process.exit(1);
  }

  const fehlend = pruefeOrdner(config.local);
  if (fehlend.length > 0) {
    console.error('❌ Konfigurierte Ordner existieren nicht (oder sind keine Verzeichnisse):');
    for (const f of fehlend) console.error('   • ' + f);
    console.error('   Pfade in ' + configPath + ' korrigieren.');
    process.exit(1);
  }

  console.log(`✓ Config valide. Variante: ${config.variant} (${config.build.label})`);
  console.log(`✓ Lokale Ordner verdrahtet — kein Ordner-Picker, IndexedDB: teamflow-${config.build.outputFilename}`);

  process.env.TEAMFLOW_CONFIG = JSON.stringify(config);
  process.env.TEAMFLOW_BUILD_TIME = new Date().toISOString();
  process.env.TEAMFLOW_GIT_HASH = 'local';

  // Vite programmatisch starten statt als Unterprozess: kein .cmd-Shim, keine
  // unescapten Argumente (Node DEP0190) und keine Abhängigkeit davon, welchen
  // Unterpfad Vites `exports`-Feld gerade freigibt. `TEAMFLOW_CONFIG` steht in
  // `process.env` und wird von vite.config.ts gelesen wie bei einem Build.
  const { createServer } = await import('vite');
  const server = await createServer({ server: { port, strictPort: true } });
  await server.listen();
  server.printUrls();
}

main().catch(err => {
  console.error('❌ Dev-Server konnte nicht starten:', err);
  process.exit(1);
});
