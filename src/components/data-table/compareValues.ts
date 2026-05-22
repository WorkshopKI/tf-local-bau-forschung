/**
 * String/Number-Vergleich fuer Tabellen-Sort. Nutzt einen Modul-Singleton-
 * Collator (Intl.Collator), damit bei N·log(N) Vergleichen die Intl-Lookup-
 * Kosten amortisiert werden.
 *
 * Verschoben aus `src/plugins/suche/suchseite-utils.ts` — beide Tabellen
 * (Suche + Auslastung) nutzen jetzt diesen Helper. Suche re-exportiert ihn
 * fuer Backwards-Kompat.
 */
import type { SortDirection } from './types';

export const DATA_TABLE_COLLATOR = new Intl.Collator('de', {
  numeric: true,
  sensitivity: 'base',
});

export function compareValues(
  a: string | number,
  b: string | number,
  dir: SortDirection,
): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }
  const cmp = DATA_TABLE_COLLATOR.compare(String(a), String(b));
  return dir === 'asc' ? cmp : -cmp;
}
