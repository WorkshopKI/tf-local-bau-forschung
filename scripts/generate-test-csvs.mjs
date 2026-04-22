// Generiert die Test-CSV-Dateien aus den TypeScript-Konstanten in
// src/plugins/csv-sources-admin/wizard/testCorpus.ts.
// Die Konstanten sind die primäre Quelle; die Dateien sind synchronisierte Build-Artefakte.
// Läuft als `prebuild`-Hook vor `build` und `build:single`.
//
// Ausgabe: public/test-korpus/bauforschung-v2/*.csv (UTF-8 ohne BOM, LF, trailing newline).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const SOURCE = path.join(ROOT, 'src/plugins/csv-sources-admin/wizard/testCorpus.ts');
const OUT_DIR = path.join(ROOT, 'public/test-korpus/bauforschung-v2');

const MAPPINGS = [
  { constant: 'STAMMDATEN_MINI', file: 'stammdaten-mini.csv', encoding: 'utf8' },
  { constant: 'STAMMDATEN_BRANCHE_MINI', file: 'stammdaten-branche-mini.csv', encoding: 'utf8' },
  { constant: 'PROJEKTZUSAMMENFASSUNG_MINI', file: 'projektzusammenfassung-mini.csv', encoding: 'utf8' },
  { constant: 'STATUS_AKTIVE_MINI', file: 'status-aktive-mini.csv', encoding: 'utf8' },
  { constant: 'STAMMDATEN_MINI_DE', file: 'stammdaten-mini-de.csv', encoding: 'latin1' },
  { constant: 'PROJEKTZUSAMMENFASSUNG_MINI_DE', file: 'projektzusammenfassung-mini-de.csv', encoding: 'latin1' },
  { constant: 'STATUS_AKTIVE_MINI_DE', file: 'status-aktive-mini-de.csv', encoding: 'latin1' },
];

const source = await readFile(SOURCE, 'utf8');
await mkdir(OUT_DIR, { recursive: true });

for (const m of MAPPINGS) {
  const re = new RegExp(`const\\s+${m.constant}\\s*=\\s*\`([\\s\\S]*?)\`;`);
  const match = source.match(re);
  if (!match) {
    throw new Error(`Konstante ${m.constant} nicht in ${SOURCE} gefunden`);
  }
  // CRLF → LF normalisieren, damit Row-Hash unabhängig vom Checkout-Format bleibt.
  const content = match[1].replace(/\r\n/g, '\n');
  const outPath = path.join(OUT_DIR, m.file);
  if (m.encoding === 'latin1') {
    const bytes = encodeLatin1(content);
    await writeFile(outPath, bytes);
  } else {
    await writeFile(outPath, content, { encoding: 'utf8' });
  }
  const lineCount = content.split('\n').length - 1;
  console.log(`  ${m.file}  (${lineCount} Zeilen inkl. Header, ${m.encoding})`);
}

console.log(`✓ ${MAPPINGS.length} Test-CSVs geschrieben nach public/test-korpus/bauforschung-v2/`);

/**
 * Kodiert einen String als Windows-1252-Bytes.
 * Deckt ASCII und Latin-1-Supplement (deutsche Umlaute) ab, plus €/„–—.
 */
function encodeLatin1(text) {
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x100) {
      bytes[i] = cp;
    } else if (cp === 0x20ac) {
      bytes[i] = 0x80; // €
    } else if (cp === 0x201a) {
      bytes[i] = 0x82;
    } else if (cp === 0x201e) {
      bytes[i] = 0x84;
    } else if (cp === 0x2013) {
      bytes[i] = 0x96;
    } else if (cp === 0x2014) {
      bytes[i] = 0x97;
    } else {
      bytes[i] = 0x3f; // '?'
    }
  }
  return bytes;
}
