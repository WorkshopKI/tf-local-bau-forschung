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

import { readFileSync, writeFileSync, copyFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { validateConfig } from './config-schema.mjs';

// .bat-Dateien brauchen CRLF, damit der Polyglot-Header (<# : ... #>) von cmd.exe
// als Batch-Wrapper erkannt wird. Source-File kann LF haben (z.B. nach Edit-Tool oder
// Linux-Checkout ohne autocrlf) — wir normalisieren beim Kopieren immer auf CRLF.
function copyBatWithCrlf(src, dst) {
  const text = readFileSync(src, 'utf8').replace(/\r?\n/g, '\r\n');
  writeFileSync(dst, text, 'utf8');
}

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

  const subdir = (config.build.outputSubdir ?? '').trim();
  const outDir = resolve(join('dist-single', subdir));
  if (subdir) mkdirSync(outDir, { recursive: true });

  const defaultOutput = resolve('dist-single/index.html');
  const targetOutput = join(outDir, `${config.build.outputFilename}.html`);

  if (!existsSync(defaultOutput)) {
    console.error(`❌ Erwartetes Build-Output fehlt: ${defaultOutput}`);
    process.exit(1);
  }

  copyFileSync(defaultOutput, targetOutput);
  if (defaultOutput !== targetOutput) {
    rmSync(defaultOutput);
  }

  // Dokumentenindex-Helper liegen einmalig im dist-single-Root (variantenunabhaengig
  // — operieren auf dem Daten-Share, nicht relativ zur HTML). Demo braucht sie nicht;
  // nur Share-Varianten (fester Pfad ODER User-Auswahl) kopieren sie ins Root.
  // Subdir-Outputs (z.B. dist-single/dev/) bekommen sie nie — Altstand wird entfernt.
  const needsDataShare = !!config.data?.fixedDataSharePath || config.data?.allowUserToChangePath === true;
  const distRoot = resolve('dist-single');
  const batNames = [
    'Dokumentenindex-aktualisieren.bat',
    'Dokumentenindex-aktualisieren-MoE.bat',
    'Dokumentenindex-LAN-Server.bat',
  ];
  const copiedBats = [];

  for (const name of batNames) {
    const src = resolve(name);
    const rootDst = resolve(`dist-single/${name}`);
    if (needsDataShare && existsSync(src)) {
      copyBatWithCrlf(src, rootDst);
      copiedBats.push(rootDst);
    }
    if (outDir !== distRoot) {
      const subdirDst = join(outDir, name);
      if (existsSync(subdirDst)) rmSync(subdirDst);
    }
  }

  console.log(`✓ Build fertig: ${targetOutput}`);
  for (const bat of copiedBats) {
    console.log(`✓ Dokumentenindex-Helper liegt unter: ${bat}`);
  }
}

main();
