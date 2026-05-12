#!/usr/bin/env node
/**
 * Normalisiert die Encodings der Real-Fixture-CSVs unter docs/fixtures/.
 *
 * Vite's `?raw`-Import liest Files immer als UTF-8. Wenn die anonymisierten
 * Fixture-CSVs aus dem Foyer-Export windows-1252-encoded sind (was sie initial
 * sind), kommen sie mit U+FFFD-Replacement-Chars im JS-String an und der
 * Parser scheitert.
 *
 * Dieses Script laeuft als prebuild/predev und konvertiert nicht-UTF-8 Files
 * idempotent zu UTF-8 (mit BOM-strip).
 *
 * Erkennung: TextDecoder('utf-8', { fatal: true }) wirft bei invaliden Bytes.
 * Wenn UTF-8-Decode erfolgreich → Datei ist UTF-8, kein Touch.
 * Sonst → windows-1252-Decode + UTF-8-write.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = join(__dirname, '..', 'docs', 'fixtures');

if (!existsSync(fixturesDir)) {
  process.exit(0);
}

const entries = readdirSync(fixturesDir).filter(f => f.toLowerCase().endsWith('.csv'));

if (entries.length === 0) {
  process.exit(0);
}

let converted = 0;
let skipped = 0;

for (const filename of entries) {
  const path = join(fixturesDir, filename);
  const bytes = readFileSync(path);

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    skipped++;
    continue;
  } catch {
    // fall through
  }

  const text = new TextDecoder('windows-1252').decode(bytes);
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  writeFileSync(path, stripped, { encoding: 'utf-8' });
  converted++;
  console.log(`[normalize-fixture-csvs] ${filename}: windows-1252 → UTF-8`);
}

if (converted > 0) {
  console.log(`[normalize-fixture-csvs] ${converted} Datei(en) konvertiert, ${skipped} bereits UTF-8.`);
}
