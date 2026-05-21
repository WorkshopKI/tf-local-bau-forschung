/**
 * Uebergreifende Suche: aggregiert Treffer aus der Foerderantraege-Suche
 * (Substring + Embedding + DMS, programm-scoped) UND aus der globalen
 * Dokumenten-Hybrid-Suche (Orama BM25 + Vector) in einer einzigen,
 * score-sortierten Liste.
 *
 * Architektur: Services werden **direkt** aufgerufen — kein Hook-in-Hook.
 *  - {@link searchAntraege} aus dem Antraege-Plugin-Service.
 *  - {@link hybridSearch} aus dem Orama-Store.
 *  - `useSearch()` wird nur read-only fuer `vectorReady`/`vectorLoading`/
 *    `documentCount` benutzt — niemals fuer den Search-Call.
 *
 * Debounce 300 ms; vorheriger Lauf wird via AbortController abgebrochen.
 *
 * Score-Strategie (siehe Plan): pragmatisch pro Quelle.
 *  - Antrags-Substring → 1.0 / fulltext
 *  - Antrags-Embedding → cosine 0.55..1.0 / vector
 *  - Antrags-DMS-Match → orama-Score 0..1 / hybrid
 *  - Dokumente-Treffer → orama-Score 0..1 / method wie von Orama
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from './useStorage';
import { useActiveProgramm } from './useActiveProgramm';
import { useSearch } from './useSearch';
import { embeddingService } from '@/core/services/search/embedding-service';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import {
  hybridSearch,
  getOramaDB,
  type OramaSearchResult,
} from '@/core/services/search/orama-store';
import {
  searchAntraege,
  getProgrammCaches,
  type AntragSearchHit,
} from '@/plugins/antraege/services/antraege-search-service';
import {
  listAntraegeListViewByProgramm,
  countAntraegeListViewByProgramm,
} from '@/core/services/csv/idb-csv';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import type { UnifiedSearchResult } from '@/core/types/search-result';

const DEBOUNCE_MS = 300;
const DOC_HIT_LIMIT = 50;

export interface UnifiedSearchCounts {
  total: number;
  antraege: number;
  dokumente: number;
  /** Bauantrag-Treffer aus dem Orama-Index (Subset von `dokumente`); fuer den
   *  Demo-Pill „Bauantraege". 0 in Prod. */
  bauantraege: number;
}

export interface UnifiedSearchIndexInfo {
  dokumenteImIndex: number;
  antraegeGeladen: number;
}

export interface UseUnifiedSearchResult {
  results: UnifiedSearchResult[];
  loading: boolean;
  error: string | null;
  counts: UnifiedSearchCounts;
  indexInfo: UnifiedSearchIndexInfo;
  vectorReady: boolean;
}

interface AntraegeListCache {
  programmId: string;
  byAkz: Map<string, AntragListItem>;
}

let cachedAntraegeListCache: AntraegeListCache | null = null;

async function getAntraegeListCache(
  idb: ReturnType<typeof useStorage>['idb'],
  programmId: string,
): Promise<AntraegeListCache> {
  if (cachedAntraegeListCache && cachedAntraegeListCache.programmId === programmId) {
    return cachedAntraegeListCache;
  }
  const items = await listAntraegeListViewByProgramm(idb, programmId);
  const byAkz = new Map(items.map(it => [it.aktenzeichen, it]));
  cachedAntraegeListCache = { programmId, byAkz };
  return cachedAntraegeListCache;
}

function makeAntragSnippet(item: AntragListItem | undefined): string {
  if (!item) return '';
  const parts: string[] = [];
  if (item.antragsteller) parts.push(item.antragsteller);
  if (item.akronym) parts.push(item.akronym);
  if (item.foerdergeber) parts.push(item.foerdergeber);
  return parts.join(' · ');
}

function mapAntragHit(
  hit: AntragSearchHit,
  item: AntragListItem | undefined,
  programmNameById: Map<string, string>,
): UnifiedSearchResult {
  return {
    id: hit.aktenzeichen,
    type: 'antrag',
    score: hit.score,
    method: hit.method,
    title: item?.titel ?? item?.akronym ?? hit.aktenzeichen,
    snippet: makeAntragSnippet(item),
    fkz: hit.aktenzeichen,
    programm: item ? (programmNameById.get(item.programm_id) ?? item.programm_id) : undefined,
    antragsteller: item?.antragsteller,
    status: item?.status,
    statusKategorie: item?.status ? getStatusCategory(item.status) : undefined,
    antragsdatum: item?.antragsdatum,
    kategorie: item?.branche,
  };
}

function mapDokumentHit(
  hit: OramaSearchResult,
  filenameToAkz: Map<string, string>,
  antraegeByAkz: Map<string, AntragListItem>,
  programmNameById: Map<string, string>,
): UnifiedSearchResult {
  const akz = filenameToAkz.get(hit.source);
  const linkedItem = akz ? antraegeByAkz.get(akz) : undefined;
  const snippet = hit.text.length > 300 ? `${hit.text.slice(0, 300)}…` : hit.text;
  return {
    id: hit.id,
    type: 'dokument',
    score: hit.score,
    method: hit.method,
    title: hit.title || hit.source,
    snippet,
    dateiname: hit.source,
    dokumentTyp: hit.type,
    zugehoerigerAntragFkz: akz,
    zugehoerigesProgramm: linkedItem
      ? (programmNameById.get(linkedItem.programm_id) ?? linkedItem.programm_id)
      : undefined,
  };
}

async function embedQueryIfReady(
  query: string,
  idb: ReturnType<typeof useStorage>['idb'],
): Promise<number[] | null> {
  if (!embeddingService.isReady()) return null;
  try {
    const modelId = await getActiveModelId(idb);
    const cfg = getModelById(modelId);
    return await embeddingService.embedSingle(query, cfg, 'query');
  } catch {
    return null;
  }
}

export function useUnifiedSearch(query: string): UseUnifiedSearchResult {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const programme = useActiveProgramm(s => s.programme);
  const { vectorReady, documentCount } = useSearch();

  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [antraegeGeladen, setAntraegeGeladen] = useState(0);

  const programmNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of programme) m.set(p.id, p.name);
    return m;
  }, [programme]);

  // Programm-Count fuer die Index-Info-Zeile.
  useEffect(() => {
    if (!activeProgrammId) { setAntraegeGeladen(0); return; }
    let cancelled = false;
    void countAntraegeListViewByProgramm(storage.idb, activeProgrammId)
      .then(c => { if (!cancelled) setAntraegeGeladen(c); })
      .catch(() => { if (!cancelled) setAntraegeGeladen(0); });
    return () => { cancelled = true; };
  }, [activeProgrammId, storage]);

  // Hauptsuche.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const abort = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          // Antraege-Hits + Dokumente-Hits parallel anstossen.
          const antraegePromise = activeProgrammId
            ? searchAntraege({
                query: q,
                idb: storage.idb,
                programmId: activeProgrammId,
                abortSignal: abort.signal,
              }).catch(err => {
                console.warn('[useUnifiedSearch] searchAntraege failed:', err);
                return { hits: [], unavailable: [] };
              })
            : Promise.resolve({ hits: [], unavailable: [] });

          // Dokumente-Suche: nur wenn Index initialisiert.
          let dokumentePromise: Promise<OramaSearchResult[]>;
          if (getOramaDB() === null) {
            dokumentePromise = Promise.resolve([]);
          } else {
            const queryVec = await embedQueryIfReady(q, storage.idb);
            dokumentePromise = Promise.resolve(
              hybridSearch(q, queryVec, { limit: DOC_HIT_LIMIT }),
            );
          }

          // Antraege-Listen-Cache + Programm-Caches (fuer filenameToAkz) parallel.
          const cachesPromise = activeProgrammId
            ? Promise.all([
                getAntraegeListCache(storage.idb, activeProgrammId),
                getProgrammCaches(storage.idb, activeProgrammId),
              ])
            : Promise.resolve([null, null] as const);

          const [antraegeResult, dokumenteHits, caches] = await Promise.all([
            antraegePromise, dokumentePromise, cachesPromise,
          ]);
          if (cancelled || abort.signal.aborted) return;

          const [listCache, programmCaches] = caches;
          const byAkz = listCache?.byAkz ?? new Map<string, AntragListItem>();
          const filenameToAkz = programmCaches?.filenameToAkz ?? new Map<string, string>();

          const antraegeMapped = antraegeResult.hits.map(h =>
            mapAntragHit(h, byAkz.get(h.aktenzeichen), programmNameById),
          );
          const dokumenteMapped = dokumenteHits.map(h =>
            mapDokumentHit(h, filenameToAkz, byAkz, programmNameById),
          );

          // Merge + sort. Dedup nur bei identischem {type, id}.
          const merged = new Map<string, UnifiedSearchResult>();
          for (const r of antraegeMapped) merged.set(`${r.type}:${r.id}`, r);
          for (const r of dokumenteMapped) {
            const key = `${r.type}:${r.id}`;
            const prev = merged.get(key);
            if (!prev || r.score > prev.score) merged.set(key, r);
          }
          const sorted = Array.from(merged.values()).sort((a, b) => b.score - a.score);

          setResults(sorted);
          setLoading(false);
        } catch (err) {
          if (cancelled || abort.signal.aborted) return;
          if ((err as Error).name === 'AbortError') return;
          console.warn('[useUnifiedSearch] failed:', err);
          setError((err as Error).message ?? 'Suche fehlgeschlagen');
          setResults([]);
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [query, activeProgrammId, storage, programmNameById]);

  const counts = useMemo<UnifiedSearchCounts>(() => {
    let antraege = 0;
    let dokumente = 0;
    let bauantraege = 0;
    for (const r of results) {
      if (r.type === 'antrag') antraege++;
      else {
        dokumente++;
        if (r.dokumentTyp === 'bauantrag') bauantraege++;
      }
    }
    return { total: results.length, antraege, dokumente, bauantraege };
  }, [results]);

  return {
    results,
    loading,
    error,
    counts,
    indexInfo: { dokumenteImIndex: documentCount, antraegeGeladen },
    vectorReady,
  };
}
