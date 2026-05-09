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
const BEARBEITER_FIELDS_LOWER_SET: ReadonlySet<string> = new Set(BEARBEITER_FIELDS_LOWER);
const BEGLEITUNG_FIELDS_LOWER_SET: ReadonlySet<string> = new Set(BEGLEITUNG_FIELDS_LOWER);
const COMBINED_FIELDS_LOWER: readonly string[] = [
  ...BEARBEITER_FIELDS_LOWER,
  ...BEGLEITUNG_FIELDS_LOWER,
];
const COMBINED_FIELDS_LOWER_SET: ReadonlySet<string> = new Set(COMBINED_FIELDS_LOWER);

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
 * Hot path: direkter Property-Zugriff auf die canonical lowercase-Keys.
 * Der Merger schreibt KUERZ-Spalten im Default-Pfad (`resolveFieldKey` →
 * `col.toLowerCase()`) immer als lowercase, der CSV-Wizard mappt sie
 * explizit auf canonical lowercase. In ~100% der Real-World-Records reicht
 * dieser Hot-Path — kein `Object.entries`/Iteration über alle Felder pro
 * Record (mit Multi-CSV-Joins schnell 50+ Felder, dann reine Verschwendung).
 *
 * Fallback scannt zusätzlich Keys mit abweichender Casing (z.B. ein
 * custom-Mapping, das das Original-Casing wie `TiB_KUERZ` direkt am Antrag
 * erhält). Der Skip auf bereits geprüfte lowercase-Keys + ein Early-Out
 * für Keys, die schon lowercase sind und nicht im Set, hält den Fallback
 * billig: für die typischen lowercase-only-Records sind es nur Set-Lookups.
 */
function forEachKuerzelValue(
  antrag: Antrag,
  fieldsLowerKeys: readonly string[],
  fieldsLowerSet: ReadonlySet<string>,
  cb: (uppered: string) => boolean,
): boolean {
  const rec = antrag as Record<string, unknown>;
  for (const k of fieldsLowerKeys) {
    const v = rec[k];
    if (typeof v !== 'string') continue;
    const upper = v.trim().toUpperCase();
    if (!upper) continue;
    if (cb(upper)) return true;
  }
  for (const key in rec) {
    if (fieldsLowerSet.has(key)) continue;
    const lk = key.toLowerCase();
    if (lk === key) continue;
    if (!fieldsLowerSet.has(lk)) continue;
    const v = rec[key];
    if (typeof v !== 'string') continue;
    const upper = v.trim().toUpperCase();
    if (!upper) continue;
    if (cb(upper)) return true;
  }
  return false;
}

function antragHasKuerzel(
  antrag: Antrag,
  fieldsLowerKeys: readonly string[],
  fieldsLowerSet: ReadonlySet<string>,
  tokens: readonly string[],
): boolean {
  return forEachKuerzelValue(antrag, fieldsLowerKeys, fieldsLowerSet, upper =>
    tokens.includes(upper),
  );
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
  if (antragHasKuerzel(antrag, BEARBEITER_FIELDS_LOWER, BEARBEITER_FIELDS_LOWER_SET, mode.tokens)) {
    return true;
  }
  if (
    mode.includeBegleitung
    && antragHasKuerzel(antrag, BEGLEITUNG_FIELDS_LOWER, BEGLEITUNG_FIELDS_LOWER_SET, mode.tokens)
  ) {
    return true;
  }
  return false;
}

/**
 * Convenience: filtert eine Liste mit dem Modus. Inaktiver Filter → unverändert.
 */
export function applyBearbeiterFilter(antraege: Antrag[], mode: BearbeiterFilterMode): Antrag[] {
  if (!mode.active) return antraege;
  // Pre-resolve Keys/Set einmal (statt pro Record): bei aktivem
  // includeBegleitung kombinieren wir Bearbeiter+Begleitungs-Felder zu
  // einem Lookup, damit pro Record genau ein Pass läuft (statt zwei
  // sequenzieller Aufrufe wie in `antragMatchesBearbeiter`).
  const keys = mode.includeBegleitung ? COMBINED_FIELDS_LOWER : BEARBEITER_FIELDS_LOWER;
  const set = mode.includeBegleitung ? COMBINED_FIELDS_LOWER_SET : BEARBEITER_FIELDS_LOWER_SET;
  const tokens = mode.tokens;
  return antraege.filter(a => antragHasKuerzel(a, keys, set, tokens));
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
  const keys = includeBegleitung ? COMBINED_FIELDS_LOWER : BEARBEITER_FIELDS_LOWER;
  const set = includeBegleitung ? COMBINED_FIELDS_LOWER_SET : BEARBEITER_FIELDS_LOWER_SET;
  for (const a of antraege) {
    if (forEachKuerzelValue(a, keys, set, () => true)) return true;
  }
  return false;
}
