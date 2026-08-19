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

export type SuchePillFilterId = '' | 'antrag' | 'dokument';

/** Backwards-Kompat: alter Name. */
export const SUCHE_COLLATOR = DATA_TABLE_COLLATOR;
export { compareValues };

export function matchesPillFilter(r: UnifiedSearchResult, filter: SuchePillFilterId): boolean {
  if (filter === '') return true;
  if (filter === 'antrag') return r.type === 'antrag';
  if (filter === 'dokument') return r.type === 'dokument';
  return true;
}

export function countResultsByType(rs: ReadonlyArray<UnifiedSearchResult>): {
  antraege: number; dokumente: number;
} {
  let antraege = 0, dokumente = 0;
  for (const r of rs) {
    if (r.type === 'antrag') antraege++;
    else dokumente++;
  }
  return { antraege, dokumente };
}

/** Die Such-Seite kennt nur die wählbaren Werte — den Auskunfts-Wert „Eigene
 *  Auswahl" gibt es dort nicht: hier steht keine Filterleiste daneben, die einen
 *  Zustand setzen könnte, den diese Pille nicht ausdrückt. */
type SucheAntragstyp = Exclude<KategorieLabel, 'Eigene Auswahl'>;

const SUCHE_ANTRAGSTYP_ORDER: SucheAntragstyp[] = ['Alle', 'FuE', 'DS', 'DL', 'NW'];

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
  const counts: Record<SucheAntragstyp, number> = { Alle: 0, FuE: 0, DS: 0, DL: 0, NW: 0 };
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

/**
 * Verlaufs-Mechanik: seit v4.106 in
 * [anfrage-verlauf.ts](src/core/services/search/anfrage-verlauf.ts), weil die
 * Förderantrags-Seite einen zweiten, eigenen Verlauf führt. Hier bleiben die
 * Namen stehen, damit die Aufrufer der Suche unverändert lesen.
 */
export {
  MAX_RECENT_SEARCHES, pushRecentSearch, filterRecentSearches,
  zaehleAnfrage, beschneideZaehler, haeufigsteAnfragen, type AnfrageZaehler,
} from '@/core/services/search/anfrage-verlauf';

// ----- Größe des Suchfelds ---------------------------------------------------

/** Gemerkte Größe des (ziehbaren) Suchfelds. */
export interface FeldGroesse { w: number; h: number }

/** Kleinstmaß des Suchfelds — darunter passt der Platzhalter nicht mehr. */
export const FELD_MIN_BREITE = 220;
/** Ein-Zeilen-Höhe (entspricht dem bisherigen `h-10`). */
export const FELD_MIN_HOEHE = 40;

/**
 * Rohwert aus localStorage → Größe, oder `null` wenn nichts Brauchbares
 * drinsteht. Rein (kein localStorage) und damit unter `environment:'node'`
 * testbar — dieselbe Trennung wie in [[assistentPanel]].
 */
export function parseFeldGroesse(raw: string | null): FeldGroesse | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { w, h } = parsed as Record<string, unknown>;
    if (typeof w !== 'number' || typeof h !== 'number') return null;
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    if (w < FELD_MIN_BREITE || h < FELD_MIN_HOEHE) return null;
    return { w: Math.round(w), h: Math.round(h) };
  } catch {
    return null;
  }
}

export function serializeFeldGroesse(g: FeldGroesse): string {
  return JSON.stringify({ w: Math.round(g.w), h: Math.round(g.h) });
}

/* „Häufig gesucht" zählt seit v4.111 wirklich — `haeufigsteAnfragen` oben,
 * gefüttert vom `zaehleAnfrage`-Schreiber im Store. Die frühere
 * `haeufigsteSuchen` nahm die zweite Hälfte der Rezenzliste und beschriftete
 * damit die am längsten NICHT gesuchten Anfragen als die häufigsten. */
