/**
 * Scan-Infrastruktur der Convention-Guards.
 *
 * Die Guards selbst bleiben vollständig in `codebase-conventions.test.ts` — der
 * Entschluss „alle Konventionen in EINER Datei" (CLAUDE.md Doku-Konvention 4) gilt
 * weiter. Ausgelagert ist nur das Werkzeug: Datei-Walk, Pfad-Formatierung und die
 * beiden Such-Primitive. Das hielt die Guard-Datei davon ab, mit jeder neuen
 * Konvention zugleich in der Infrastruktur zu wachsen.
 *
 * Keine Testfälle hier — diese Datei wird importiert, nicht ausgeführt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

export const ROOT = join(__dirname, '..');

export function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.vite') continue;
      walk(p, out);
    } else if (s.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx'))) {
      out.push(p);
    }
  }
  return out;
}

export const ALL_TS_FILES = walk(ROOT);

// Wie walk(), aber fuer .css — der theme-token-contract-Guard muss auch CSS
// scannen (chat/gutachten/felder nutzen die Tokens dort). ALL_TS_FILES bleibt
// bewusst unberuehrt, damit die uebrigen Guards unveraendert nur .ts/.tsx scopen.
export function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.vite') continue;
      walkCss(p, out);
    } else if (s.isFile() && entry.endsWith('.css')) {
      out.push(p);
    }
  }
  return out;
}

export const ALL_SOURCE_FILES = [...ALL_TS_FILES, ...walkCss(ROOT)];

export interface Finding {
  file: string;
  line: number;
  text: string;
}

export function relPath(abs: string): string {
  const rel = abs.slice(ROOT.length + 1);
  return `src${sep}${rel}`.replace(/\\/g, '/');
}

export function findInFile(
  file: string,
  predicate: (line: string) => boolean,
  whitelistMarker: string,
): Finding[] {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);
  const out: Finding[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.includes(whitelistMarker)) continue;
    if (predicate(line)) {
      out.push({ file: relPath(file), line: i + 1, text: line.trim() });
    }
  }
  return out;
}

export function fmt(findings: Finding[]): string {
  return findings.map(f => `  ${f.file}:${f.line}\n    ${f.text}`).join('\n');
}

/**
 * Dateiweiter Check (fuer Regeln, die nicht zeilen-lokal entscheidbar sind):
 * Eine Datei verstoesst, wenn sie irgendwo eine `trigger`-Zeile enthaelt (z.B.
 * einen bestimmten Funktionsaufruf), aber NIRGENDWO `requiredRef` referenziert.
 * Markierte Trigger-Zeilen (`marker`) werden uebersprungen; enthaelt die Datei
 * `requiredRef` an beliebiger Stelle, gilt sie als konform. Pro Datei max. ein
 * Treffer (die erste unmarkierte Trigger-Zeile genuegt als Beleg).
 */
export function findFilesViolating(
  trigger: (line: string) => boolean,
  requiredRef: string,
  marker: string,
  isAllowed: (file: string) => boolean,
): Finding[] {
  const out: Finding[] = [];
  for (const file of ALL_TS_FILES) {
    if (isAllowed(file)) continue;
    const content = readFileSync(file, 'utf-8');
    if (content.includes(requiredRef)) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes(marker)) continue;
      // Kommentar-Zeilen (JSDoc-Erwaehnungen wie `importCsvSource()`) sind keine
      // echten Aufrufe — ueberspringen, sonst False-Positives in der Doku.
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
      if (trigger(line)) {
        out.push({ file: relPath(file), line: i + 1, text: line.trim() });
        break;
      }
    }
  }
  return out;
}
