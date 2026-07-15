#!/usr/bin/env node
/**
 * TeamFlow Code-Map-Generator.
 *
 * Erzeugt `docs/architecture/code-map.md` — eine generierte Übersicht aller
 * `.ts`/`.tsx`-Dateien unter `src/` mit Zeilenzahl (LOC), gruppiert nach
 * Verzeichnis. Zweck: Explorer-Agents lesen EINE Datei statt 1.500+ zu scannen.
 *
 * Deterministisch (stabile Sortierung), reine Node-Stdlib, keine Dependencies.
 * Die Ausgabe ist gitignored (regeneriert per `precheck`-Hook) — das Datum im
 * Kopf erzeugt daher kein Diff-Rauschen.
 *
 * Aufruf:
 *   node scripts/generate-code-map.mjs
 *   npm run map
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'docs', 'architecture', 'code-map.md');

const IGNORE_DIRS = new Set(['node_modules']);
const MAX_BYTES = 150 * 1024;

/** Zählt Codezeilen (newline-basiert, robust gegen fehlenden Trailing-Newline). */
function countLoc(content) {
  if (content.length === 0) return 0;
  let lines = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++;
  }
  // Endet die Datei auf \n, ist die letzte "Zeile" leer → nicht mitzählen.
  if (content.charCodeAt(content.length - 1) === 10) lines--;
  return lines;
}

/** Rekursiv alle .ts/.tsx unter dir sammeln; Pfade POSIX-relativ zu ROOT. */
function collectFiles(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('dist')) continue;
      collectFiles(join(dir, entry.name), acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      const abs = join(dir, entry.name);
      const rel = relative(ROOT, abs).split('\\').join('/');
      acc.push({ rel, loc: countLoc(readFileSync(abs, 'utf8')) });
    }
  }
  return acc;
}

const de = (n) => n.toLocaleString('de-DE');
const isTestFile = (rel) =>
  rel.split('/').includes('__tests__') || /\.test\.tsx?$/.test(basename(rel));

function buildSections(files) {
  // sections: dir -> { files: [{name, loc}], testDir?: {count, loc} }
  const sections = new Map();
  const section = (dir) => {
    if (!sections.has(dir)) sections.set(dir, { files: [], testDir: null });
    return sections.get(dir);
  };

  for (const f of files) {
    const segs = f.rel.split('/');
    const ti = segs.indexOf('__tests__');
    if (ti >= 0) {
      // Alles unterhalb des ersten __tests__-Segments zu EINER Summenzeile beim Elternverzeichnis.
      const parent = segs.slice(0, ti).join('/');
      const sec = section(parent);
      if (!sec.testDir) sec.testDir = { count: 0, loc: 0 };
      sec.testDir.count++;
      sec.testDir.loc += f.loc;
    } else {
      const parent = segs.slice(0, -1).join('/');
      section(parent).files.push({ name: segs[segs.length - 1], loc: f.loc });
    }
  }
  return sections;
}

function render(files) {
  const total = files.length;
  const totalLoc = files.reduce((s, f) => s + f.loc, 0);
  const testFiles = files.filter((f) => isTestFile(f.rel));
  const testLoc = testFiles.reduce((s, f) => s + f.loc, 0);
  const date = new Date().toISOString().slice(0, 10);

  const top15 = files
    .filter((f) => !isTestFile(f.rel))
    .sort((a, b) => b.loc - a.loc || (a.rel < b.rel ? -1 : 1))
    .slice(0, 15);

  const sections = buildSections(files);
  const dirs = [...sections.keys()].sort();

  const out = [];
  out.push('# Code-Map — TeamFlow (GENERIERT)');
  out.push('');
  out.push('> **GENERIERT — nicht von Hand editieren.** Aktualisieren: `npm run map`.');
  out.push(`> Stand: ${date} · Quelle: \`scripts/generate-code-map.mjs\` · gitignored.`);
  out.push('');
  out.push(
    `**Summe:** ${de(total)} Dateien · ${de(totalLoc)} LOC ` +
      `(davon Tests: ${de(testFiles.length)} Dateien / ${de(testLoc)} LOC).`,
  );
  out.push('');
  out.push('## Top 15 größte Nicht-Test-Dateien');
  out.push('');
  out.push('Watchlist für den Konsolidierungs-Pass (Datei-Splits ab ~500 LOC).');
  out.push('');
  top15.forEach((f, i) => out.push(`${i + 1}. \`${f.rel}\` — ${de(f.loc)} LOC`));
  out.push('');
  out.push('## Dateien nach Verzeichnis');
  out.push('');
  for (const dir of dirs) {
    const sec = sections.get(dir);
    out.push(`### ${dir}/`);
    for (const file of sec.files.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      out.push(`- \`${file.name}\` — ${de(file.loc)} LOC`);
    }
    if (sec.testDir) {
      out.push(`- \`__tests__/\` — ${de(sec.testDir.count)} Dateien, ${de(sec.testDir.loc)} LOC`);
    }
    out.push('');
  }
  return out.join('\n');
}

function main() {
  let files;
  try {
    files = collectFiles(SRC, []);
  } catch (err) {
    console.error(`❌ Konnte src/ nicht lesen: ${err.message}`);
    process.exit(1);
  }
  const markdown = render(files);
  writeFileSync(OUT, markdown, 'utf8');

  const bytes = Buffer.byteLength(markdown, 'utf8');
  if (bytes > MAX_BYTES) {
    console.error(
      `⚠ code-map.md ist ${de(Math.round(bytes / 1024))} KB (> 150 KB) — ` +
        `Format ggf. weiter verdichten.`,
    );
  }
  console.log(
    `✓ code-map.md: ${de(files.length)} Dateien, ${de(Math.round(bytes / 1024))} KB → ${relative(ROOT, OUT).split('\\').join('/')}`,
  );
}

main();
