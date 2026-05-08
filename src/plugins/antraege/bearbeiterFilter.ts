import type { Antrag } from '@/core/services/csv/types';

/**
 * Bearbeiter-Kürzel-Filter.
 *
 * CSV-Spalten (raw, kommen unverändert aus dem Import auf den Antrag):
 * - Bearbeiter:  `TiB_KUERZ`, `BIB_KUERZ`
 * - Begleitung:  `ZTP_KUERZ`, `PFM_KUERZ`
 *
 * Casing-Hinweis: das CSV-Mapping fällt für Spalten ohne explizites
 * canonical/custom auf `column.toLowerCase()` zurück (siehe
 * `src/core/services/csv/merger/helpers.ts` → `resolveFieldKey`). Eine
 * Spalte `ZTP_KUERZ` landet dann als Antrag-Property `ztp_kuerz`. Wir
 * matchen daher case-insensitive über `Object.entries(antrag)`.
 *
 * Profil-Konfiguration (`UserProfile.bearbeiter_kuerzel`):
 * - leer / nicht gesetzt → Filter inaktiv
 * - "alle" (case-insensitive) → Filter inaktiv (PL-Modus)
 * - "MUE"  → matched gegen ein einzelnes Kürzel
 * - "MUE, SCH" → mehrere Kürzel komma-separiert (für Vertretung)
 */

const BEARBEITER_FIELDS_LOWER: readonly string[] = ['tib_kuerz', 'bib_kuerz'];
const BEGLEITUNG_FIELDS_LOWER: readonly string[] = ['ztp_kuerz', 'pfm_kuerz'];

export interface BearbeiterFilterMode {
  /** Aktiv? Wenn false, lassen sich Anträge unfiltriert durchreichen. */
  active: boolean;
  /** Tokens, gegen die gematcht wird (uppercase, getrimmt). */
  tokens: string[];
  /** Auch Begleitungs-Spalten (ZTP, PFM) berücksichtigen. */
  includeBegleitung: boolean;
}

const INACTIVE: BearbeiterFilterMode = { active: false, tokens: [], includeBegleitung: false };

/**
 * Parst das Profil-Feld zu einem normalisierten Filter-Modus.
 * - Leer / undefined / nur Whitespace → inaktiv
 * - "alle" (case-insensitive) → inaktiv
 * - Sonst: comma-split, trim, uppercase, leere Tokens entfernt.
 */
export function parseBearbeiterFilter(
  raw: string | undefined,
  includeBegleitung: boolean | undefined,
): BearbeiterFilterMode {
  if (!raw) return INACTIVE;
  const trimmed = raw.trim();
  if (!trimmed) return INACTIVE;
  if (trimmed.toLowerCase() === 'alle') return INACTIVE;
  const tokens = trimmed
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
  if (tokens.length === 0) return INACTIVE;
  return { active: true, tokens, includeBegleitung: !!includeBegleitung };
}

/**
 * Iteriert über alle Properties des Antrags, deren Key (case-insensitive)
 * in `fieldsLower` enthalten ist, und ruft den Callback mit dem String-Wert
 * (getrimmt, uppercased). Stoppt bei `cb()` === true.
 */
function forEachKuerzelValue(
  antrag: Antrag,
  fieldsLower: readonly string[],
  cb: (uppered: string) => boolean,
): boolean {
  for (const [key, val] of Object.entries(antrag)) {
    if (typeof val !== 'string') continue;
    if (!fieldsLower.includes(key.toLowerCase())) continue;
    const upper = val.trim().toUpperCase();
    if (!upper) continue;
    if (cb(upper)) return true;
  }
  return false;
}

function antragHasKuerzel(antrag: Antrag, fieldsLower: readonly string[], tokens: string[]): boolean {
  return forEachKuerzelValue(antrag, fieldsLower, upper => tokens.includes(upper));
}

/**
 * True wenn der Antrag dem Bearbeiter-Filter genügt.
 * Logik:
 * - mode.active=false → IMMER true (Filter aus, alle durchreichen)
 * - sonst: match wenn das Kürzel in einer der Bearbeiter-Spalten steht;
 *   bei `includeBegleitung=true` zusätzlich in den Begleitungs-Spalten.
 *
 * Wichtig: wenn der Antrag KEINE der Spalten gesetzt hat (z.B. weil das
 * verwendete Schema die KUERZ-Spalten nicht mappt), wird er bei aktivem
 * Filter ausgeblendet — kein implizites Show-All.
 */
export function antragMatchesBearbeiter(antrag: Antrag, mode: BearbeiterFilterMode): boolean {
  if (!mode.active) return true;
  if (antragHasKuerzel(antrag, BEARBEITER_FIELDS_LOWER, mode.tokens)) return true;
  if (mode.includeBegleitung && antragHasKuerzel(antrag, BEGLEITUNG_FIELDS_LOWER, mode.tokens)) return true;
  return false;
}

/**
 * Convenience: filtert eine Liste mit dem Modus. Inaktiver Filter → unverändert.
 */
export function applyBearbeiterFilter(antraege: Antrag[], mode: BearbeiterFilterMode): Antrag[] {
  if (!mode.active) return antraege;
  return antraege.filter(a => antragMatchesBearbeiter(a, mode));
}

/**
 * Prüft, ob in den Antraegen mindestens ein KUERZ-Wert vorhanden ist.
 * Verwendet für UX-Hinweis: wenn der Bearbeiter-Filter aktiv ist, aber
 * keine der CSV-Quellen die KUERZ-Spalten mappt, sieht der User eine leere
 * Liste. Mit dieser Detection können wir stattdessen eine Erklärung zeigen.
 *
 * `includeBegleitung=true` schließt zusätzlich ZTP_KUERZ + PFM_KUERZ ein.
 *
 * Match ist case-insensitive — die CSV-Spalte `ZTP_KUERZ` kann je nach
 * Mapping als `ZTP_KUERZ`, `ztp_kuerz` oder beliebig gemixt landen.
 */
export function hasAnyKuerzelData(antraege: Antrag[], includeBegleitung: boolean): boolean {
  const fieldsLower = includeBegleitung
    ? [...BEARBEITER_FIELDS_LOWER, ...BEGLEITUNG_FIELDS_LOWER]
    : [...BEARBEITER_FIELDS_LOWER];
  for (const a of antraege) {
    if (forEachKuerzelValue(a, fieldsLower, () => true)) return true;
  }
  return false;
}
