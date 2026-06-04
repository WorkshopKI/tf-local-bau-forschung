/**
 * Kleine Pure-Helper fuer die SuchSeite (Filter-Pill-Logik, Pill-Counts).
 * Sort-Vergleich + Collator leben seit der data-table-Extraktion unter
 * `@/components/data-table/compareValues` und werden hier nur re-exportiert,
 * damit bestehende Such-Tests + interne Aufrufe stabil bleiben.
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { compareValues, DATA_TABLE_COLLATOR } from '@/components/data-table';
import { getKategorieLabel, type KategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import type { CollapsibleSegItem } from '@/plugins/antraege/filter/CollapsibleSeg';

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

const SUCHE_ANTRAGSTYP_ORDER: KategorieLabel[] = ['Alle', 'FuE', 'DS', 'DL', 'NW'];

/**
 * Items fuer den Antragstyp-`CollapsibleSeg` auf der Such-Seite: Alle +
 * FuE/DS/DL/NW mit Counts. Gezaehlt wird ueber die Antrag-Treffer (Dokumente
 * haben kein `vbPhase`). Counts gehen ueber die gesamte uebergebene Liste —
 * stabil, nicht ueber die aktuell gefilterte Teilmenge (gleiche Regel wie die
 * Foerderantraege-Quickfilter).
 */
export function getSucheAntragstypItems(
  results: ReadonlyArray<UnifiedSearchResult>,
): CollapsibleSegItem[] {
  const counts: Record<KategorieLabel, number> = { Alle: 0, FuE: 0, DS: 0, DL: 0, NW: 0 };
  for (const r of results) {
    if (r.type !== 'antrag') continue;
    counts.Alle++;
    const bucket = getKategorieLabel(r.vbPhase);
    if (bucket) counts[bucket]++;
  }
  return SUCHE_ANTRAGSTYP_ORDER.map(label => ({ label, count: counts[label] }));
}

/**
 * Predicate: matcht der Treffer den gewaehlten Antragstyp? `'Alle'` matcht
 * alles. Nur Antrag-Treffer koennen einen Bucket matchen — Dokumente fallen
 * bei gesetztem Filter heraus (gleiche Semantik wie der Typ-Spalten-Filter).
 */
export function matchesSucheAntragstyp(r: UnifiedSearchResult, antragstyp: KategorieLabel): boolean {
  if (antragstyp === 'Alle') return true;
  return r.type === 'antrag' && getKategorieLabel(r.vbPhase) === antragstyp;
}

/** Default-Cap fuer die persistierte Such-Historie. */
export const MAX_RECENT_SEARCHES = 15;

/**
 * Fuegt eine Anfrage vorne in die Recent-Search-Liste ein (most-recent-first).
 *
 * - `trim`; zu kurze (`len < 2`) Anfragen werden ignoriert → unveraenderte
 *   Liste (Identitaet bleibt erhalten, damit der Store ein No-op erkennt).
 * - Case-insensitives Dedupe: ein bereits vorhandener identischer Eintrag wird
 *   entfernt und neu nach vorne gesetzt (Move-to-front).
 * - Prefix-Suppression: aeltere Eintraege, die ein PRAEFIX der neuen Anfrage
 *   sind, fallen raus ("standardisierung" ersetzt das fruehere "standard").
 *   Laengere Eintraege, von denen die neue Anfrage ein Praefix ist, bleiben.
 * - Auf `max` gekappt.
 */
export function pushRecentSearch(list: string[], q: string, max: number = MAX_RECENT_SEARCHES): string[] {
  const trimmed = q.trim();
  if (trimmed.length < 2) return list;
  const lower = trimmed.toLowerCase();
  const kept = list.filter(e => !lower.startsWith(e.toLowerCase()));
  return [trimmed, ...kept].slice(0, max);
}

/**
 * Filtert die Recent-Search-Liste fuer die Vorschlags-Anzeige.
 *
 * - Leere Query → die `max` juengsten Eintraege.
 * - Sonst case-insensitiver Substring-Match; der Eintrag, der exakt der
 *   aktuellen Query entspricht, wird ausgeschlossen (kein Vorschlag fuer das
 *   bereits Getippte).
 */
export function filterRecentSearches(list: string[], query: string, max: number = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q === '') return list.slice(0, max);
  return list.filter(e => {
    const el = e.toLowerCase();
    return el !== q && el.includes(q);
  }).slice(0, max);
}
