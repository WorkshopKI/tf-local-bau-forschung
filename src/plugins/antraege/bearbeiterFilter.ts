import type { Antrag } from '@/core/services/csv/types';

/**
 * Bearbeiter-Kürzel-Filter.
 *
 * CSV-Spalten (raw, kommen unverändert aus dem Import auf den Antrag):
 * - Bearbeiter:  `TiB_KUERZ`, `BIB_KUERZ`
 * - Begleitung:  `ZTP_KUERZ`, `PFM_KUERZ`
 *
 * Profil-Konfiguration (`UserProfile.bearbeiter_kuerzel`):
 * - leer / nicht gesetzt → Filter inaktiv
 * - "alle" (case-insensitive) → Filter inaktiv (PL-Modus)
 * - "MUE"  → matched gegen ein einzelnes Kürzel
 * - "MUE, SCH" → mehrere Kürzel komma-separiert (für Vertretung)
 */

const BEARBEITER_FIELDS = ['TiB_KUERZ', 'BIB_KUERZ'] as const;
const BEGLEITUNG_FIELDS = ['ZTP_KUERZ', 'PFM_KUERZ'] as const;

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

function antragHasKuerzel(antrag: Antrag, fields: readonly string[], tokens: string[]): boolean {
  for (const field of fields) {
    const v = (antrag as Record<string, unknown>)[field];
    if (typeof v !== 'string') continue;
    const upper = v.trim().toUpperCase();
    if (!upper) continue;
    if (tokens.includes(upper)) return true;
  }
  return false;
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
  if (antragHasKuerzel(antrag, BEARBEITER_FIELDS, mode.tokens)) return true;
  if (mode.includeBegleitung && antragHasKuerzel(antrag, BEGLEITUNG_FIELDS, mode.tokens)) return true;
  return false;
}

/**
 * Convenience: filtert eine Liste mit dem Modus. Inaktiver Filter → unverändert.
 */
export function applyBearbeiterFilter(antraege: Antrag[], mode: BearbeiterFilterMode): Antrag[] {
  if (!mode.active) return antraege;
  return antraege.filter(a => antragMatchesBearbeiter(a, mode));
}
