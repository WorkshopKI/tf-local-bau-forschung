#!/usr/bin/env node
/**
 * TeamFlow Version-Bump + Changelog-Tooling.
 *
 * Bumpt `package.json#version`, fügt ein Kompakt-Skeleton oben in CHANGELOG.md
 * (optional changelog-user.md) ein und rotiert übergroße CHANGELOG.md-Blöcke
 * ins Archiv. Reine Node-Stdlib, keine Dependencies.
 *
 * Kernlogik (Skeleton-Insertion, Rotation/Block-Split) sind PURE, exportierte
 * Funktionen (String → String, kein FS) — unit-getestet in
 * src/__tests__/version-bump.test.ts. Nur main() macht FS-I/O.
 *
 * Aufrufe:
 *   node scripts/version-bump.mjs <major|minor|patch> "<Titel>" [--user]
 *   node scripts/version-bump.mjs --rotate-only
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const ARCHIV = join(ROOT, 'docs', '_archiv', 'CHANGELOG-ARCHIV.md');
const USER_CHANGELOG = join(ROOT, 'src', 'core', 'components', 'changelog', 'changelog-user.md');
const PKG = join(ROOT, 'package.json');

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const TRIGGER_BYTES = 100 * 1024;
const TARGET_BYTES = 80 * 1024;
const MIN_KEEP = 30;

const bytes = (s) => Buffer.byteLength(s, 'utf8');

// ── Pure functions (exported for tests) ──────────────────────────────────

/** Bumpt das `version`-Feld im package.json-Text; gibt {text, version} zurück. */
export function bumpVersionField(pkgText, kind) {
  const m = pkgText.match(/"version"\s*:\s*"(\d+)\.(\d+)\.(\d+)"/);
  if (!m) throw new Error('version-Feld in package.json nicht gefunden');
  const maj = Number(m[1]);
  const min = Number(m[2]);
  const pat = Number(m[3]);
  let version;
  if (kind === 'major') version = `${maj + 1}.0.0`;
  else if (kind === 'minor') version = `${maj}.${min + 1}.0`;
  else if (kind === 'patch') version = `${maj}.${min}.${pat + 1}`;
  else throw new Error(`ungültiger Bump-Typ: ${kind} (major|minor|patch)`);
  return { text: pkgText.replace(m[0], `"version": "${version}"`), version };
}

/** Zerlegt einen Changelog-Text in {header, blocks[]} an `^### v`-Grenzen. */
export function splitIntoBlocks(text) {
  const parts = text.split(/(?=^### v)/m);
  return { header: parts[0] ?? '', blocks: parts.slice(1) };
}

/** Fügt ein Kompakt-Skeleton vor dem ersten `### v` in CHANGELOG.md ein. */
export function insertChangelogSkeleton(changelogText, { version, title, kind, monthYear }) {
  const { header, blocks } = splitIntoBlocks(changelogText);
  const typ = kind.toUpperCase();
  const skeleton =
    `### v${version} — ${title} (${monthYear})\n\n` +
    `${typ} — <!-- Motivation: max. 3 Zeilen. Detail gehört ins Themen-Doc, nicht hierher. -->\n\n` +
    `- <!-- max. 5 Bullets à 1 Zeile: WAS + Datei-Link; kein WIE -->\n\n`;
  return header + skeleton + blocks.join('');
}

/** Steht in changelog-user.md schon ein Block `## v<majorMinor>`? */
export function hatUserBlock(userText, majorMinor) {
  const escaped = majorMinor.replace(/\./g, '\\.');
  // `(?![\d.])`: `## v6.6` ist nicht `## v6.60`.
  return new RegExp(`^## v${escaped}(?![\\d.])`, 'm').test(userText);
}

/**
 * Fügt ein geglättetes Skeleton vor dem ersten `## v` in changelog-user.md ein.
 *
 * Die Nutzer-Fassung führt einen Block je Minor-Version; ein Patch mit `--user`
 * gehört in den bestehenden. Steht `## v<majorMinor>` schon da, bleibt der Text
 * unverändert — vorher entstand eine zweite gleichnamige Überschrift, die jedes
 * Mal von Hand zusammengeführt werden musste.
 */
export function insertUserSkeleton(userText, { majorMinor, isoMonth }) {
  if (hatUserBlock(userText, majorMinor)) return userText;
  const parts = userText.split(/(?=^## v)/m);
  const header = parts[0] ?? '';
  const rest = parts.slice(1).join('');
  const skeleton =
    `## v${majorMinor} — ${isoMonth}\n\n` +
    `### Neu\n<!-- - Kurzer, verständlicher Satz (nur bei nutzersichtbaren Änderungen) -->\n` +
    `### Verbesserungen\n<!-- - … -->\n` +
    `### Bugfixes\n<!-- - … -->\n\n`;
  return header + skeleton + rest;
}

/**
 * Rotiert übergroße CHANGELOG.md-Blöcke ins Archiv.
 * Ist changelogText ≤ trigger → No-op. Sonst von UNTEN ganze Blöcke abtrennen,
 * bis ≤ targetMax, dabei ≥ minKeep neueste behalten; abgetrennte Blöcke (in
 * unveränderter, absteigender Reihenfolge) vor den ersten `### v` des Archivs.
 * Gibt {changelog, archive, rotated} zurück.
 */
export function rotateChangelog(changelogText, archiveText, opts = {}) {
  const trigger = opts.trigger ?? TRIGGER_BYTES;
  const targetMax = opts.targetMax ?? TARGET_BYTES;
  const minKeep = opts.minKeep ?? MIN_KEEP;
  if (bytes(changelogText) <= trigger) {
    return { changelog: changelogText, archive: archiveText, rotated: 0 };
  }
  const { header, blocks } = splitIntoBlocks(changelogText);
  let keptCount = blocks.length;
  const sizeOf = (n) => bytes(header + blocks.slice(0, n).join(''));
  while (keptCount > minKeep && sizeOf(keptCount) > targetMax) keptCount--;

  const peeled = blocks.slice(keptCount);
  if (peeled.length === 0) {
    return { changelog: changelogText, archive: archiveText, rotated: 0 };
  }
  const newChangelog = header + blocks.slice(0, keptCount).join('');

  const archive = splitIntoBlocks(archiveText);
  let peeledStr = peeled.join('');
  if (!peeledStr.endsWith('\n')) peeledStr += '\n';
  const newArchive = archive.header + peeledStr + archive.blocks.join('');
  return { changelog: newChangelog, archive: newArchive, rotated: peeled.length };
}

// ── FS wrapper (main) ────────────────────────────────────────────────────

function parseArgs(argv) {
  if (argv.includes('--rotate-only')) return { rotateOnly: true };
  const kind = argv[0];
  const title = argv[1];
  const user = argv.includes('--user');
  if (!['major', 'minor', 'patch'].includes(kind)) {
    throw new Error('Aufruf: version-bump.mjs <major|minor|patch> "<Titel>" [--user]  |  --rotate-only');
  }
  if (!title || title.startsWith('--')) throw new Error('Titel fehlt (in Anführungszeichen).');
  return { rotateOnly: false, kind, title, user };
}

function main() {
  const now = new Date();
  const args = parseArgs(process.argv.slice(2));

  if (args.rotateOnly) {
    const r = rotateChangelog(readFileSync(CHANGELOG, 'utf8'), readFileSync(ARCHIV, 'utf8'));
    if (r.rotated > 0) {
      writeFileSync(CHANGELOG, r.changelog, 'utf8');
      writeFileSync(ARCHIV, r.archive, 'utf8');
    }
    console.log(`✓ Rotation: ${r.rotated} Blöcke ins Archiv (CHANGELOG.md jetzt ${Math.round(bytes(r.changelog) / 1024)} KB)`);
    return;
  }

  const { text: pkgText, version } = bumpVersionField(readFileSync(PKG, 'utf8'), args.kind);
  writeFileSync(PKG, pkgText, 'utf8');

  const monthYear = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const withSkeleton = insertChangelogSkeleton(readFileSync(CHANGELOG, 'utf8'), {
    version, title: args.title, kind: args.kind, monthYear,
  });
  const r = rotateChangelog(withSkeleton, readFileSync(ARCHIV, 'utf8'));
  writeFileSync(CHANGELOG, r.changelog, 'utf8');
  if (r.rotated > 0) writeFileSync(ARCHIV, r.archive, 'utf8');

  let userHinweis = '';
  if (args.user) {
    const [maj, min] = version.split('.');
    const majorMinor = `${maj}.${min}`;
    const isoMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const vorher = readFileSync(USER_CHANGELOG, 'utf8');
    const withUser = insertUserSkeleton(vorher, { majorMinor, isoMonth });
    if (withUser === vorher) {
      userHinweis = `  → changelog-user.md: Block „## v${majorMinor}" besteht — die Einträge dort ergänzen.`;
    } else {
      writeFileSync(USER_CHANGELOG, withUser, 'utf8');
    }
  }

  const userNeu = args.user && userHinweis === '';
  console.log(
    `✓ v${version} — Skeleton in CHANGELOG.md${userNeu ? ' + changelog-user.md' : ''} eingefügt` +
      (r.rotated > 0 ? `; ${r.rotated} alte Blöcke ins Archiv rotiert` : ''),
  );
  if (userHinweis) console.log(userHinweis);
  console.log('  → Skeleton-Kommentare im Kompaktformat ausfüllen (max. 3 Zeilen Motivation + max. 5 Bullets).');
}

// Nur ausführen, wenn direkt gestartet (nicht beim Import in Tests).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
