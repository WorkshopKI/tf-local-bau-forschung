/**
 * Kleine Pure-Helper fuer die SuchSeite (Filter-Pill-Logik, Pill-Counts).
 * Sort-Vergleich + Collator leben seit der data-table-Extraktion unter
 * `@/components/data-table/compareValues` und werden hier nur re-exportiert,
 * damit bestehende Such-Tests + interne Aufrufe stabil bleiben.
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { compareValues, DATA_TABLE_COLLATOR } from '@/components/data-table';

export type SuchePillFilterId = '' | 'antrag' | 'dokument' | 'bauantrag';

/** Backwards-Kompat: alter Name. */
export const SUCHE_COLLATOR = DATA_TABLE_COLLATOR;
export { compareValues };

export function matchesPillFilter(r: UnifiedSearchResult, filter: SuchePillFilterId): boolean {
  if (filter === '') return true;
  if (filter === 'antrag') return r.type === 'antrag';
  if (filter === 'dokument') return r.type === 'dokument';
  if (filter === 'bauantrag') return r.type === 'dokument' && r.dokumentTyp === 'bauantrag';
  return true;
}

export function countResultsByType(rs: ReadonlyArray<UnifiedSearchResult>): {
  antraege: number; dokumente: number; bauantraege: number;
} {
  let antraege = 0, dokumente = 0, bauantraege = 0;
  for (const r of rs) {
    if (r.type === 'antrag') antraege++;
    else {
      dokumente++;
      if (r.dokumentTyp === 'bauantrag') bauantraege++;
    }
  }
  return { antraege, dokumente, bauantraege };
}
