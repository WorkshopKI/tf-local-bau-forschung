/**
 * Scan-Infrastruktur der Convention-Guards.
 *
 * Die Guards selbst liegen in den `conventions-*.test.ts` daneben, thematisch
 * geschnitten (Status / Oberfläche / Daten) plus `health-baseline.test.ts`.
 * Ausgelagert ist hier nur das Werkzeug: Datei-Walk, Pfad-Formatierung und die
 * Such-Primitive — es wird von allen vier geteilt, damit ein Guard nie seinen
 * eigenen Scanner mitbringt.
 *
 * Keine Testfälle hier — diese Datei wird importiert, nicht ausgeführt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

export const ROOT = join(__dirname, '..');

/**
 * Verzeichnisse, die KEIN Guard scannen soll.
 *
 * `generated` traegt das inline-gzippte ORT-WASM als base64: 7,34 MB in EINER
 * Zeile von 7.340.705 Zeichen. Das sind 27,5 % von allem, was die Guards lesen —
 * bei rund 74 Voll-Durchlaeufen je Suite-Lauf etwa 543 MB Lesen und Zeilen-Splitten
 * fuer eine Datei, die keine einzige Konvention enthaelt. Und jede Zahlen-Heuristik
 * trifft dort, weil in einer base64-Zeile jede Ziffernfolge vorkommt; die
 * Fehlermeldung sprengt dann jede Konsole.
 *
 * Der Ausschluss stand bis v6.40 in genau EINEM Guard
 * (`no-inline-frist-arithmetik`), der die Falle als Einziger getreten hatte.
 * Hier steht er einmal fuer alle.
 */
const UEBERSPRUNGEN = new Set(['node_modules', 'dist', '.vite', 'generated']);

export function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (UEBERSPRUNGEN.has(entry)) continue;
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
      if (UEBERSPRUNGEN.has(entry)) continue;
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

/**
 * Wie `findInFile`, aber ueber den GANZEN Dateitext — fuer Regeln, die ueber
 * einem BLOCK entscheiden statt ueber einer Zeile (leerer `catch`-Rumpf,
 * mehrzeilige Signatur, `it`-Block ohne Zusicherung).
 *
 * `re` MUSS das `g`-Flag tragen und darf `\n` matchen. Die gemeldete Zeile ist
 * die ERSTE des Treffers; entsprechend muss auch der `// allow-…`-Marker dort
 * stehen, nicht irgendwo im Block.
 *
 * Existiert, damit ein blockweiser Guard nicht seinen eigenen Datei-Scan
 * mitbringt — der Modulkopf oben nennt genau das als Zweck dieser Datei.
 */
export function findInContent(
  file: string,
  re: RegExp,
  whitelistMarker: string,
): Finding[] {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);
  const out: Finding[] = [];
  for (const m of content.matchAll(re)) {
    const nr = content.slice(0, m.index).split(/\r?\n/).length;
    const zeile = lines[nr - 1] ?? '';
    if (zeile.includes(whitelistMarker)) continue;
    out.push({ file: relPath(file), line: nr, text: zeile.trim() });
  }
  return out;
}

/**
 * Fundstellen fuer eine Fehlermeldung formatieren.
 *
 * `max` kappt die Liste — noetig fuer Ratschen, die dreistellige Trefferzahlen
 * fuehren koennen: eine Fehlermeldung, die 300 Zeilen ausrollt, wird nicht
 * gelesen, sondern weggescrollt. Ohne `max` bleibt das Verhalten wie bisher.
 */
export function fmt(findings: Finding[], max?: number): string {
  const gezeigt = max === undefined ? findings : findings.slice(0, max);
  const liste = gezeigt.map(f => `  ${f.file}:${f.line}\n    ${f.text}`).join('\n');
  const rest = findings.length - gezeigt.length;
  return rest > 0 ? `${liste}\n  … und ${rest} weitere` : liste;
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

// --- Markdown-Links ---------------------------------------------------------
// Zwei Guards lesen Links aus Markdown (`doc-links`, `agent-konfiguration`).
// Extraktion und Klassifikation sind Primitive wie der Datei-Walk; welche
// Dateien geprüft werden, entscheidet jeder Guard selbst.

/** Alle `href`s aus `[text](href)`-Links, in Dateireihenfolge. */
export function extractHrefs(md: string): string[] {
  const re = /\[[^\]]*\]\(([^)\s]+)\)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

export function stripAnchor(href: string): string {
  return href.split('#')[0] ?? '';
}

/** Relativer Doc-Link (kein http/mailto, kein reiner `#anker`). */
export function isRelativeDocLink(href: string): boolean {
  if (/^(https?:|mailto:)/i.test(href)) return false;
  return stripAnchor(href).length > 0;
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
