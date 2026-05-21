/**
 * Stufe 2: Kandidaten finden — keine LLM-Calls.
 *
 * Zwei parallele Wege:
 *  - Weg A: strukturierte Pre-Filter (Datum, Programm, Status, Branche,
 *    Foerdergeber) als JS-Praedikate auf `AntragListItem[]`.
 *  - Weg B: pro `semantischeQueries[i]` ein `searchAntraege`-Call,
 *    Vereinigung der Aktenzeichen-Sets, max-score je Akz.
 *
 * Merge: Schnittmenge aus Weg A + Weg B. Warnung wenn < 5 oder Cap auf 500
 * wenn > 500.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AntragListItem } from '@/core/services/csv/types';
import { listAntraegeListViewByProgramm } from '@/core/services/csv/idb-csv';
import { searchAntraege } from '@/plugins/antraege/services/antraege-search-service';
import { getStatusCategory } from '@/core/utils/status-canonical';
import type { QueryUnderstanding } from './query-understanding';

export interface RetrievalCandidate {
  aktenzeichen: string;
  score: number;
  item: AntragListItem;
}

export interface RetrievalResult {
  candidates: RetrievalCandidate[];
  totalBeforeCap: number;
  warnings: string[];
}

const CAP = 500;
const SMALL_RESULT_THRESHOLD = 5;

function inRange(dateStr: string | undefined, von?: string, bis?: string): boolean {
  if (!dateStr) return !von && !bis;
  if (von && dateStr < von) return false;
  if (bis && dateStr > bis) return false;
  return true;
}

function lowerSet(values: string[] | undefined): Set<string> | null {
  if (!values || values.length === 0) return null;
  return new Set(values.map(v => v.toLowerCase().trim()));
}

function passesPreFilter(
  item: AntragListItem,
  q: QueryUnderstanding,
  programmIdSet: Set<string> | null,
): boolean {
  const f = q.strukturierteFilter;
  if (f.zeitraum && (f.zeitraum.von || f.zeitraum.bis)) {
    if (!inRange(item.antragsdatum, f.zeitraum.von, f.zeitraum.bis)) return false;
  }
  if (programmIdSet && !programmIdSet.has(item.programm_id)) return false;
  const statusSet = lowerSet(f.status);
  if (statusSet) {
    const raw = item.status?.toString().toLowerCase().trim() ?? '';
    const cat = item.status ? getStatusCategory(item.status).toLowerCase() : '';
    if (!statusSet.has(raw) && !statusSet.has(cat)) return false;
  }
  const branSet = lowerSet(f.branchen);
  if (branSet && !branSet.has((item.branche ?? '').toLowerCase())) return false;
  const fgSet = lowerSet(f.foerdergeber);
  if (fgSet && !fgSet.has((item.foerdergeber ?? '').toLowerCase())) return false;
  return true;
}

function resolveProgrammIdSet(
  programmeNames: string[] | undefined,
  nameToId: Map<string, string>,
): Set<string> | null {
  if (!programmeNames || programmeNames.length === 0) return null;
  const out = new Set<string>();
  for (const name of programmeNames) {
    const id = nameToId.get(name.toLowerCase().trim());
    if (id) out.add(id);
  }
  return out.size > 0 ? out : null;
}

export async function stageRetrieval(opts: {
  understanding: QueryUnderstanding;
  idb: IDBStore;
  programmId: string;
  programmNameToId: Map<string, string>;
  signal: AbortSignal;
}): Promise<RetrievalResult> {
  const { understanding, idb, programmId, programmNameToId, signal } = opts;
  const warnings: string[] = [];

  // Weg A: structured pre-filter
  const items = await listAntraegeListViewByProgramm(idb, programmId);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const programmIdSet = resolveProgrammIdSet(understanding.strukturierteFilter.programme, programmNameToId);
  // Wenn das LLM Programme genannt hat, die wir nicht aufloesen konnten,
  // hat es vermutlich Tippfehler oder unbekannte Namen — wir warnen, aber
  // ignorieren den Filter (besser zu viel als zu wenig).
  if (understanding.strukturierteFilter.programme && understanding.strukturierteFilter.programme.length > 0 && !programmIdSet) {
    warnings.push(`Programm-Namen konnten nicht aufgeloest werden: ${understanding.strukturierteFilter.programme.join(', ')}`);
  }

  const preFiltered = items.filter(it => passesPreFilter(it, understanding, programmIdSet));
  const preFilteredAkz = new Set(preFiltered.map(it => it.aktenzeichen));
  const itemByAkz = new Map(preFiltered.map(it => [it.aktenzeichen, it]));

  // Weg B: semantische Hybrid-Suche (parallel je Query)
  const semantische = understanding.semantischeQueries;
  const semanticPromises = semantische.map(q =>
    searchAntraege({ query: q, idb, programmId, abortSignal: signal })
      .catch(err => {
        console.warn('[stage-retrieval] searchAntraege failed:', err);
        return { hits: [], unavailable: [] };
      }),
  );
  const semanticResults = await Promise.all(semanticPromises);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // Union der semantischen Treffer mit max-score je Akz
  const semScoreByAkz = new Map<string, number>();
  for (const result of semanticResults) {
    for (const hit of result.hits) {
      const prev = semScoreByAkz.get(hit.aktenzeichen);
      if (prev === undefined || hit.score > prev) {
        semScoreByAkz.set(hit.aktenzeichen, hit.score);
      }
    }
  }

  // Wenn die semantischen Queries gar keine Treffer haben (z.B. weil noch
  // kein Embedding-Korpus + DMS-Index existiert), fallen wir auf die
  // strukturelle Pre-Filterung zurueck — sonst ist die Schnittmenge leer.
  const hasSemantic = semScoreByAkz.size > 0;
  const candidates: RetrievalCandidate[] = [];
  if (hasSemantic) {
    for (const [akz, score] of semScoreByAkz.entries()) {
      if (!preFilteredAkz.has(akz)) continue;
      const item = itemByAkz.get(akz);
      if (!item) continue;
      candidates.push({ aktenzeichen: akz, score, item });
    }
  } else {
    warnings.push('Keine semantischen Treffer — fahre nur mit strukturierter Vorfilterung fort.');
    for (const item of preFiltered) {
      candidates.push({ aktenzeichen: item.aktenzeichen, score: 0.5, item });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const totalBeforeCap = candidates.length;

  if (totalBeforeCap < SMALL_RESULT_THRESHOLD && totalBeforeCap > 0) {
    warnings.push(`Nur ${totalBeforeCap} Kandidaten gefunden — Filter koennten zu eng sein.`);
  }
  let final = candidates;
  if (totalBeforeCap > CAP) {
    warnings.push(`Mehr als ${CAP} Kandidaten gefunden — auf Top-${CAP} nach Relevanz beschraenkt.`);
    final = candidates.slice(0, CAP);
  }

  return { candidates: final, totalBeforeCap, warnings };
}
