/**
 * Auflösung der Vollständigkeits-Felder (D_XTEC / D_ADV) aus dem CSV-Schema.
 *
 * Hintergrund: Die Auslastungs-Vollständigkeitsprüfung braucht die Datums-Werte
 * der Spalten **D_XTEC** (FuE/DS) und **D_ADV** (DL/NW). Diese landen je nach
 * Mapping unter dem kanonischen Feld `d_xtec`/`d_adv` (Standardfeld) ODER unter
 * einem Custom-Key (Eigenes Feld — z.B. aus der Spalten-Beschreibung abgeleitet
 * wie `alle_antrage_in_c16_eingegeben`). Statt das Antrag-Feld fest zu verdrahten,
 * lösen wir es über die Schema-`column_mapping` anhand des Spalten-CODES (`D_XTEC`
 * / `D_ADV`) auf — damit funktioniert die Prüfung unabhängig davon, ob der Kurator
 * die Spalte als Standard- oder als Eigenes Feld gemappt hat.
 */
import type { CsvSchema } from '@/core/services/csv/types';
import { resolveFieldKey } from '@/core/services/csv/merger/helpers';
import { CANONICAL_D_XTEC, CANONICAL_D_ADV } from '../types';

export interface VollstaendigkeitsFelder {
  /** Antrag-Feld-Key, in dem die D_XTEC-Spalte landet (Default: `d_xtec`). */
  xtecFeld: string;
  /** Antrag-Feld-Key, in dem die D_ADV-Spalte landet (Default: `d_adv`). */
  advFeld: string;
}

export const DEFAULT_VOLLSTAENDIGKEITS_FELDER: VollstaendigkeitsFelder = {
  xtecFeld: CANONICAL_D_XTEC,
  advFeld: CANONICAL_D_ADV,
};

/** Normalisierung für den Spalten-Code-Vergleich: lower + ohne `_`/`-`/Space
 *  (analog `CANONICAL_FIELD_NAME_ALIASES`-Matching). `D_XTEC` → `dxtec`. */
const normCode = (s: string): string => s.toLowerCase().replace(/[\s_-]/g, '');

/**
 * Findet das Antrag-Feld zur CSV-Spalte mit Code `columnCode` (z.B. `D_XTEC`).
 * Master-Schema zuerst (es trägt die Vollständigkeits-Spalten). Aufgelöst über
 * `resolveFieldKey` (canonical → custom → `col.toLowerCase()`). Fallback bei
 * keinem Treffer: `fallback` (der kanonische Default).
 */
function resolveFeld(schemas: readonly CsvSchema[], columnCode: string, fallback: string): string {
  const target = normCode(columnCode);
  const ordered = [...schemas].sort((a, b) => (b.is_master ? 1 : 0) - (a.is_master ? 1 : 0));
  for (const sc of ordered) {
    const cm = sc.column_mapping ?? {};
    for (const col of Object.keys(cm)) {
      const entry = cm[col];
      if (!entry || entry.ignore) continue;
      if (normCode(col) === target) {
        const feld = resolveFieldKey(col, entry);
        if (feld) return feld;
      }
    }
  }
  return fallback;
}

/**
 * Löst die Antrag-Feld-Keys für D_XTEC + D_ADV aus den Programm-Schemas auf.
 * Greift kein Schema (oder keine passende Spalte) → kanonische Defaults
 * (`d_xtec`/`d_adv`) = bisheriges Verhalten für sauber gemappte Quellen.
 */
export function resolveVollstaendigkeitsFelder(schemas: readonly CsvSchema[]): VollstaendigkeitsFelder {
  return {
    xtecFeld: resolveFeld(schemas, 'D_XTEC', CANONICAL_D_XTEC),
    advFeld: resolveFeld(schemas, 'D_ADV', CANONICAL_D_ADV),
  };
}
