#!/usr/bin/env node
/**
 * TeamFlow Zyklen-Waechter.
 *
 * Findet LAUFZEIT-Importzyklen unter `src/` und vergleicht sie gegen eine
 * kuratierte Allowlist. Ein neuer, nicht gelisteter Zyklus bricht den Lauf ab.
 *
 * Warum eigen statt madge: das Repo faehrt bewusst eine schlanke devDependency-
 * Liste (npm audit 0). Fuer die Frage „gibt es einen NEUEN Zyklus?" genuegt ein
 * Import-Scan — der volle TS-Parser eines Graph-Tools waere hier ein grosser
 * Abhaengigkeitsbaum fuer wenig Mehrwert.
 *
 * Was NICHT als Kante zaehlt:
 *  - `import type` / `export type` — ein reiner Typ-Zyklus wird vom Compiler
 *    geloescht und kann zur Laufzeit nichts kaputtmachen (haette die Allowlist
 *    nur aufgeblaeht).
 *  - Inline-`type`-Spezifier (`import { type Foo }`) in einem sonst leeren
 *    Import — dito, es bleibt kein Wert uebrig.
 *  - `__tests__/` + `*.test.ts(x)` — Testdateien sind Blaetter, nie Teil eines
 *    Produktionszyklus.
 *
 * Deterministisch, reine Node-Stdlib. Aufruf:
 *   node scripts/check-cycles.mjs
 *   npm run cycles
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');

/**
 * Bekannte, bewusst geduldete Zyklen. Jeder Eintrag ist die Menge der beteiligten
 * Module (POSIX-relativ zu ROOT, ohne Endung) plus eine Begruendung. Die Menge
 * wird ungeordnet verglichen — die Reihenfolge, in der die Tiefensuche den Zyklus
 * betritt, haengt an der Datei-Sortierung und ist keine Eigenschaft des Zyklus.
 *
 * Ein Eintrag hier ist eine Entscheidung, keine Ablage: er gehoert begruendet,
 * und wer einen davon aufloest, loescht die Zeile.
 */
const ALLOWLIST = [
  // LEER — und das ist der Soll-Zustand. Der Konsolidierungs-Pass hat die vier
  // Laufzeit-Zyklen aufgeloest, die es gab (alle vier nach demselben Muster: ein
  // Modul zog ein Symbol aus einem Barrel, das nebenbei eine Komponente mitlud,
  // die `@/plugins.config` braucht — und die Plugin-Liste fuehrt zu jedem Modul
  // zurueck). Ein neuer Eintrag hier ist deshalb begruendungspflichtig, kein
  // Ablage-Ort: erst pruefen, ob ein Direktimport auf das Quellmodul reicht.
  //
  // Format: { module: ['src/a', 'src/b'], grund: '…' }
];

const IGNORE_DIRS = new Set(['node_modules', '__tests__']);

/** Rekursiv alle .ts/.tsx unter dir sammeln (absolute Pfade). */
function collectFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('dist')) continue;
      collectFiles(abs, acc);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(abs);
    }
  }
  return acc;
}

/**
 * Spezifier aller WERT-tragenden Imports/Re-Exports einer Datei.
 *
 * Bewusst regex-basiert (kein Parser): der Scan muss nur entscheiden, ob eine
 * Laufzeit-Kante existiert. Zeilenkommentare werden vorher entfernt, damit ein
 * `// import x from 'y'` in einem Docstring keine Geister-Kante erzeugt.
 */
function readImportSpecifiers(file) {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const out = [];
  // `import … from 'x'`, `export … from 'x'`, `import 'x'`, `import('x')`.
  const re = /(?:^|[\s;}])(import|export)\s*([\s\S]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|[\s;])import\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const bareOrDynamic = m[4] ?? m[5];
    if (bareOrDynamic) { out.push(bareOrDynamic); continue; }
    const klausel = m[2] ?? '';
    // `import type { … }` / `export type { … }` → keine Laufzeit-Kante.
    if (/^type\b/.test(klausel.trim())) continue;
    // Named-Import, in dem JEDER Spezifier ein Inline-`type` ist → ebenfalls keine.
    const named = klausel.match(/\{([\s\S]*)\}/);
    const vorKlammer = klausel.slice(0, named ? klausel.indexOf('{') : klausel.length).trim();
    if (named && !vorKlammer.replace(/,$/, '').trim()) {
      const teile = named[1].split(',').map(s => s.trim()).filter(Boolean);
      if (teile.length > 0 && teile.every(t => /^type\s/.test(t))) continue;
    }
    out.push(m[3]);
  }
  return out;
}

/** Modul-Spezifier → absoluter Dateipfad unter src/, oder null (extern/nicht auflösbar). */
function resolveSpecifier(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // npm-Paket
  // Vite-Suffixe (`?worker&inline`, `?raw`, …) abschneiden.
  base = base.split('?')[0];
  for (const kand of [
    base, `${base}.ts`, `${base}.tsx`,
    join(base, 'index.ts'), join(base, 'index.tsx'),
  ]) {
    if (existsSync(kand) && statSync(kand).isFile() && /\.tsx?$/.test(kand)) return kand;
  }
  return null;
}

const key = (abs) => relative(ROOT, abs).split('\\').join('/').replace(/\.tsx?$/, '');

/**
 * Zyklische Cluster finden — starke Zusammenhangskomponenten (Tarjan), iterativ.
 *
 * Bewusst SCCs statt einzelner Zyklus-Pfade: eine Tiefensuche mit Pfad-Stack
 * findet nur die Zyklen, die sie zufaellig zuerst betritt, und uebersieht jeden
 * weiteren durch einen bereits abgeschlossenen Knoten — ein Waechter, der
 * Zyklen uebersehen kann, ist wertlos. Die SCC-Mitgliedschaft ist dagegen
 * vollstaendig UND unabhaengig von der Besuchsreihenfolge: jede SCC mit mehr
 * als einem Knoten enthaelt mindestens einen Zyklus, und jeder Zyklus liegt
 * vollstaendig in genau einer SCC. Damit ist die Mitglieder-Menge ein stabiler
 * Allowlist-Schluessel.
 *
 * Iterativ (kein Rekursions-Stack): der Graph hat ~1.500 Knoten und tiefe
 * Import-Ketten.
 */
function findCycleClusters(graph) {
  const index = new Map();
  const low = new Map();
  const aufStack = new Set();
  const stack = [];
  const cluster = [];
  let zaehler = 0;

  for (const start of [...graph.keys()].sort()) {
    if (index.has(start)) continue;
    // Rahmen: [knoten, kantenIndex]
    const arbeit = [[start, 0]];
    index.set(start, zaehler); low.set(start, zaehler); zaehler++;
    stack.push(start); aufStack.add(start);

    while (arbeit.length > 0) {
      const rahmen = arbeit[arbeit.length - 1];
      const [node] = rahmen;
      const kanten = graph.get(node) ?? [];
      if (rahmen[1] < kanten.length) {
        const next = kanten[rahmen[1]++];
        if (!index.has(next)) {
          index.set(next, zaehler); low.set(next, zaehler); zaehler++;
          stack.push(next); aufStack.add(next);
          arbeit.push([next, 0]);
        } else if (aufStack.has(next)) {
          low.set(node, Math.min(low.get(node), index.get(next)));
        }
        continue;
      }
      arbeit.pop();
      if (arbeit.length > 0) {
        const eltern = arbeit[arbeit.length - 1][0];
        low.set(eltern, Math.min(low.get(eltern), low.get(node)));
      }
      if (low.get(node) === index.get(node)) {
        const komponente = [];
        let w;
        do { w = stack.pop(); aufStack.delete(w); komponente.push(w); } while (w !== node);
        // Einzelknoten nur zyklisch, wenn er sich selbst importiert (praktisch nie).
        if (komponente.length > 1 || (graph.get(node) ?? []).includes(node)) {
          cluster.push(komponente.sort());
        }
      }
    }
  }
  return cluster;
}

/** Ein konkreter Zyklus-Pfad innerhalb eines Clusters (Breitensuche zurueck zum Start). */
function beispielPfad(graph, cluster) {
  const drin = new Set(cluster);
  const start = cluster[0];
  const vorgaenger = new Map();
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    for (const next of graph.get(node) ?? []) {
      if (!drin.has(next)) continue;
      if (next === start) {
        const pfad = [node];
        let cur = node;
        while (vorgaenger.has(cur)) { cur = vorgaenger.get(cur); pfad.unshift(cur); }
        return [...pfad, start];
      }
      if (!vorgaenger.has(next) && next !== start) { vorgaenger.set(next, node); queue.push(next); }
    }
  }
  return cluster;
}

function main() {
  const files = collectFiles(SRC);
  const graph = new Map();
  for (const file of files) {
    const kanten = [];
    for (const spec of readImportSpecifiers(file)) {
      const ziel = resolveSpecifier(spec, file);
      if (ziel && ziel !== file) kanten.push(key(ziel));
    }
    graph.set(key(file), [...new Set(kanten)].sort());
  }

  const cluster = findCycleClusters(graph);
  const sig = (module) => [...module].sort().join('|');
  const erlaubt = new Set(ALLOWLIST.map(e => sig(e.module)));
  const gefunden = new Set(cluster.map(sig));
  const neue = cluster.filter(c => !erlaubt.has(sig(c)));
  const veraltet = ALLOWLIST.filter(e => !gefunden.has(sig(e.module)));

  if (neue.length > 0) {
    console.error(`\n❌ ${neue.length} nicht gelistete(s) zyklische(s) Import-Cluster:\n`);
    for (const c of neue) {
      console.error(`  Beteiligt (${c.length}):`);
      for (const m of c) console.error(`    ${m}`);
      console.error(`  Beispiel-Pfad:\n    ${beispielPfad(graph, c).join('\n    → ')}\n`);
    }
    console.error(
      'Aufloesen: den Barrel-Import durch einen Direktimport auf das Quellmodul\n' +
      'ersetzen, oder die Kante als `import type` fuehren, wenn nur Typen gebraucht\n' +
      'werden. Ist der Zyklus bewusst und harmlos, mit Begruendung in die ALLOWLIST\n' +
      'in scripts/check-cycles.mjs aufnehmen.\n',
    );
    process.exit(1);
  }

  if (veraltet.length > 0) {
    console.error(`\n❌ ${veraltet.length} ALLOWLIST-Eintrag/-Eintraege ohne echten Zyklus:\n`);
    for (const e of veraltet) console.error(`  ${e.module.join(' ↔ ')}`);
    console.error('\nDer Zyklus ist aufgeloest — Eintrag aus scripts/check-cycles.mjs loeschen.\n');
    process.exit(1);
  }

  console.log(
    `✓ Zyklen-Check: ${files.length} Dateien, ${cluster.length} zyklische(s) Cluster ` +
    `(alle in der Allowlist begruendet).`,
  );
}

main();
