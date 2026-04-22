#!/usr/bin/env node
/**
 * TeamFlow Build-Orchestrator.
 *
 * Liest eine JSON-Config, validiert sie (Sicherheits-Check inklusive),
 * setzt Env-Vars für `vite build --mode single` und benennt das Output-HTML
 * gemäß `build.outputFilename` um. Kopiert zusätzlich die `Dokumentenindex-
 * aktualisieren.bat` nach `dist-single/`.
 *
 * Aufrufe:
 *   node scripts/build-with-config.mjs --config configs/dev.config.json
 */

import { readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { validateConfig } from './config-schema.mjs';

function parseArgs(argv) {
  const args = argv.slice(2);
  const idx = args.indexOf('--config');
  if (idx === -1 || !args[idx + 1]) {
    console.error('Usage: node scripts/build-with-config.mjs --config <config-file>');
    process.exit(1);
  }
  return { configPath: args[idx + 1] };
}

function loadConfig(configPath) {
  const abs = resolve(configPath);
  if (!existsSync(abs)) {
    console.error(`❌ Config-Datei nicht gefunden: ${abs}`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf-8'));
  } catch (err) {
    console.error(`❌ Config-Datei ist kein gültiges JSON (${configPath}): ${err.message}`);
    process.exit(1);
  }
}

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

function main() {
  const { configPath } = parseArgs(process.argv);
  const config = loadConfig(configPath);

  const { errors, warnings, valid } = validateConfig(config);
  if (warnings.length > 0) {
    console.warn('⚠  Config-Warnungen:');
    for (const w of warnings) console.warn('   • ' + w);
  }
  if (!valid) {
    console.error('❌ Config-Fehler, Build abgebrochen:');
    for (const e of errors) console.error('   • ' + e);
    process.exit(1);
  }

  console.log(`✓ Config valide. Baue Variante: ${config.variant} (${config.build.label})`);

  process.env.TEAMFLOW_CONFIG = JSON.stringify(config);
  process.env.TEAMFLOW_BUILD_TIME = new Date().toISOString();
  process.env.TEAMFLOW_GIT_HASH = getGitHash();

  execSync('tsc -b && vite build --mode single', { stdio: 'inherit', env: process.env });

  const defaultOutput = resolve('dist-single/index.html');
  const targetOutput = resolve(`dist-single/${config.build.outputFilename}.html`);

  if (!existsSync(defaultOutput)) {
    console.error(`❌ Erwartetes Build-Output fehlt: ${defaultOutput}`);
    process.exit(1);
  }

  copyFileSync(defaultOutput, targetOutput);
  if (defaultOutput !== targetOutput) {
    rmSync(defaultOutput);
  }

  const batSrc = resolve('Dokumentenindex-aktualisieren.bat');
  const batDst = resolve('dist-single/Dokumentenindex-aktualisieren.bat');
  if (existsSync(batSrc)) {
    copyFileSync(batSrc, batDst);
  }

  console.log(`✓ Build fertig: dist-single/${config.build.outputFilename}.html`);
  if (existsSync(batDst)) {
    console.log(`✓ Dokumentenindex-Helper kopiert: dist-single/Dokumentenindex-aktualisieren.bat`);
  }
}

main();
