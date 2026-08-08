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

// --- Farbrechnung -----------------------------------------------------------
// Zwei Guards prüfen Kontraste (`preset-contrast-contract`,
// `band-fuellung-kontrast`). Die Rechnung ist ein Primitiv wie der Datei-Walk;
// die REGELN — welche Farbe wogegen wie viel erreichen muss — bleiben drüben.

/** HSL (h in Grad, s/l als 0…1) → sRGB-Kanäle als 0…1. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

/** Relative Luminanz nach WCAG 2.1 (Kanäle 0…1). */
export function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number): number => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Kontrastverhältnis zweier Farben (Kanäle 0…1); 1 = gleich, 21 = Schwarz/Weiß. */
export function kontrast(
  a: [number, number, number], b: [number, number, number],
): number {
  const [hell, dunkel] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hell + 0.05) / (dunkel + 0.05);
}

/** `#rrggbb` → sRGB-Kanäle als 0…1. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255) as [number, number, number];
}

/** `color-mix(in srgb, a p%, b)` als Zahlenrechnung — dieselbe lineare Mischung
 *  in sRGB, die der Browser für `color-mix(in srgb, …)` macht. */
export function mische(
  a: [number, number, number], b: [number, number, number], anteilA: number,
): [number, number, number] {
  return a.map((v, i) => v * anteilA + b[i]! * (1 - anteilA)) as [number, number, number];
}

/** `#rrggbb` oder `hsl(h, s%, l%)` aus `theme.css` → sRGB 0…1; `null` sonst. */
export function parseCssFarbe(wert: string): [number, number, number] | null {
  if (wert.startsWith('#')) return hexToRgb(wert);
  const m = wert.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
  if (m === null) return null;
  const [, h, s, l] = m as unknown as [string, string, string, string];
  return hslToRgb(parseFloat(h), parseFloat(s) / 100, parseFloat(l) / 100);
}

/** Ein Farb-Satz aus `theme.css` — ein Eintrag je Modus. */
export interface ThemeFarbSatz {
  modus: 'hell' | 'dunkel';
  /** Rohwerte, wie sie in der Datei stehen. */
  werte: Map<string, string>;
}

/**
 * Liest die `--tf-*`-Deklarationen aus `src/theme.css`, getrennt nach Modus.
 *
 * Die Datei führt zuerst `:root` (hell), dann den Dark-Block; ein Token, das
 * zweimal vorkommt, gehört beim zweiten Mal dem dunklen Modus. Genau diese
 * Reihenfolge ist die einzige Annahme — kein CSS-Parser, keine Selektor-Logik.
 * Tokens, die nur einmal stehen, gelten in beiden Modi und landen in beiden
 * Sätzen.
 */
export function themeFarbTokens(): [ThemeFarbSatz, ThemeFarbSatz] {
  const hell: ThemeFarbSatz = { modus: 'hell', werte: new Map() };
  const dunkel: ThemeFarbSatz = { modus: 'dunkel', werte: new Map() };
  for (const line of readFileSync(join(ROOT, 'theme.css'), 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*(--tf-[a-z0-9-]+)\s*:\s*([^;]+);/);
    if (m === null) continue;
    const [, name, wert] = m as unknown as [string, string, string];
    (hell.werte.has(name) ? dunkel : hell).werte.set(name, wert.trim());
  }
  // Was nur einmal deklariert ist, gilt überall — sonst fehlte es dem dunklen
  // Satz, und ein Guard hielte das für „nicht definiert".
  for (const [name, wert] of hell.werte) {
    if (!dunkel.werte.has(name)) dunkel.werte.set(name, wert);
  }
  return [hell, dunkel];
}
