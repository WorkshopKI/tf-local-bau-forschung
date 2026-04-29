/**
 * FKZ-Extraktor.
 *
 * Zwei Modi:
 *  - **Strict** (DMS-CSV-Bezeichnung): keine OCR-Verzerrungen, präzise Regex
 *  - **Tolerant** (OCR-Text aus Stage 2): erlaubt 1lI/6GO-Verwechslungen
 *    in den ersten beiden Stellen + 0–2 Whitespace-Zeichen zwischen
 *    Komponenten. Output wird kanonisch normalisiert.
 *
 * Präfix-Allowlist kommt aus `runtimeConfig.scan.fkz_allowed_prefixes`.
 * Caller validiert das Ergebnis gegen diese Liste.
 */

import { scanConfig } from '../../config/feature-flags';

export interface ExtractedFkz {
  /** Kanonische Form ohne Whitespace. */
  fkz: string;
  /** Das 4-stellige Präfix (z.B. "16KN"). */
  prefix: string;
  /** Substring-Position im Quelltext, falls relevant für Debug. */
  index: number;
}

/** Standard-Allowlist holen, mit harmloser Default. */
function allowedPrefixes(prefixesOverride?: string[]): string[] {
  const list = prefixesOverride ?? scanConfig.fkz_allowed_prefixes;
  return list.length > 0 ? list : ['16EP', '16KN', '16DS', '16DL'];
}

/**
 * Strikter Extraktor — für die Bezeichnung-Spalte aus der DMS-CSV.
 * Pattern: `<prefix>\d{6}` mit Negative-Lookahead auf weitere Ziffer.
 * Keine `\b`-Boundaries (siehe filter-dms-csv.mjs Begründung).
 */
export function extractFkzStrict(text: string, prefixesOverride?: string[]): ExtractedFkz | null {
  const prefixes = allowedPrefixes(prefixesOverride);
  const pattern = new RegExp(`(${prefixes.join('|')})(\\d{6})(?!\\d)`);
  const m = pattern.exec(text);
  if (!m || !m[1] || !m[2]) return null;
  return { fkz: `${m[1]}${m[2]}`, prefix: m[1], index: m.index };
}

/**
 * Toleranter Extraktor — für OCR-Text mit möglichen Verwechslungen.
 * Erlaubt:
 *  - Vor dem Buchstaben-Paar: `[1lI]` für `1`, `[6GO]` für `6`
 *  - Nach dem Buchstaben-Paar: 6 Zeichen aus `[\dOlIB]`
 *    (O→0, l/I→1, B→8 Normalisierung)
 *  - 0–2 Whitespace zwischen den Komponenten
 *
 * Buchstaben-Paar selbst ist case-sensitive (harter Anker). Output ist
 * immer kanonisch (4 Zeichen Präfix + 6 Ziffern).
 */
export function extractFkzTolerant(text: string, prefixesOverride?: string[]): ExtractedFkz | null {
  const prefixes = allowedPrefixes(prefixesOverride);
  // Buchstaben-Paar pro Präfix → Map zurück zu Präfix
  const letterPairs = new Map<string, string>();
  for (const p of prefixes) {
    letterPairs.set(p.slice(2), p); // letzte 2 Zeichen = Buchstaben-Paar
  }
  const pairAlt = [...letterPairs.keys()].join('|');
  // [1lI]\s*[6GO]\s*<pairAlt>\s*[\dOlIB]{6}
  const pattern = new RegExp(`([1lI])\\s{0,2}([6GO])\\s{0,2}(${pairAlt})\\s{0,2}([\\dOlIB]{6})`);
  const m = pattern.exec(text);
  if (!m || !m[3] || !m[4]) return null;
  // Normalisieren
  const digits = m[4]
    .replace(/[Ol]/g, c => (c === 'O' ? '0' : '1'))
    .replace(/I/g, '1')
    .replace(/B/g, '8');
  if (!/^\d{6}$/.test(digits)) return null;
  const pair = m[3];
  const fullPrefix = letterPairs.get(pair);
  if (!fullPrefix) return null;
  return { fkz: `${fullPrefix}${digits}`, prefix: fullPrefix, index: m.index };
}

/** Versucht erst strict, fällt auf tolerant zurück. */
export function extractFkz(text: string, prefixesOverride?: string[]): ExtractedFkz | null {
  return extractFkzStrict(text, prefixesOverride) ?? extractFkzTolerant(text, prefixesOverride);
}

/** Validiert dass eine FKZ-Schreibweise dem erlaubten Format folgt. */
export function isValidFkz(fkz: string, prefixesOverride?: string[]): boolean {
  if (!/^\d{2}[A-Z]{2}\d{6}$/.test(fkz)) return false;
  const prefixes = allowedPrefixes(prefixesOverride);
  return prefixes.includes(fkz.slice(0, 4));
}
