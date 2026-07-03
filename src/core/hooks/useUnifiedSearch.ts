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
import { useSemanticSearchMode } from './useSemanticSearchMode';
import { embeddingService } from '@/core/services/search/embedding-service';
import { embedQueryCached } from '@/core/services/search/query-embedder';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import {
  hybridSearch,
  getOramaDB,
  type OramaSearchResult,
} from '@/core/services/search/orama-store';
import {
  searchAntraegeSubstring,
  searchAntraegeVector,
  searchAntraegeDms,
  getProgrammCaches,
  getEmbeddings,
  STREAMING_CONSTS,
  isSemanticSearchActive,
  type AntragSearchHit,
} from '@/plugins/antraege/services/antraege-search-service';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { pipelineLog } from '@/core/services/search/pipeline-logger';
import {
  listAntraegeListViewByProgramm,
  countAntraegeListViewByProgramm,
} from '@/core/services/csv/idb-csv';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusCategory } from '@/core/utils/status-canonical';
import { useUnterprogrammLabels } from '@/plugins/antraege/useUnterprogrammLabels';
import type { UnifiedSearchResult } from '@/core/types/search-result';

const DEBOUNCE_MS = 300;
const DOC_HIT_LIMIT = 50;

export interface UnifiedSearchCounts {
  total: number;
  antraege: number;
  dokumente: number;
}

export interface UnifiedSearchIndexInfo {
  textabschnitteImIndex: number;
  antraegeGeladen: number;
}

/** Phase der Streaming-Pipeline. `substring` → erste Treffer sichtbar;
 *  `vector` → Embedding-Treffer kommen hinzu; `orama` → Dokument-Treffer
 *  + DMS-Antrags-Match werden ergaenzt; `done` → finaler Stand. */
export type SearchPhase = 'idle' | 'substring' | 'vector' | 'orama' | 'done' | 'error';

/** Diagnose der Ähnlichkeits-Stage (v2.62.2): Unter `file://` ist die Console
 *  meist zu — stille Leerlauf-Pfade (Modell lädt nicht / Korpus lokal leer)
 *  sahen für den User aus wie „Umschalten tut nichts". Der Status macht die
 *  Ursache im UI anzeigbar. `null` = Stage lief nicht (Opt-in aus / Query zu
 *  kurz / noch keine Suche), `ok` = Vector-Stage ist durchgelaufen. */
export type SemanticStatus = 'ok' | 'model-failed' | 'corpus-empty' | null;

export interface UseUnifiedSearchResult {
  results: UnifiedSearchResult[];
  loading: boolean;
  error: string | null;
  counts: UnifiedSearchCounts;
  indexInfo: UnifiedSearchIndexInfo;
  vectorReady: boolean;
  /** Welche Pipeline-Stage gerade laeuft. Fuer Status-Badge im UI. */
  searchPhase: SearchPhase;
  /** Warum die Ähnlichkeits-Stage ggf. keine Treffer liefern konnte. */
  semanticStatus: SemanticStatus;
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
    // Roher Unterprogramm-Code; das sprechende Label wird erst nach dem Mappen
    // via useUnterprogrammLabels aufgeloest (Fallback = Code).
    unterprogramm: item?.unterprogramm_id?.trim() || undefined,
    antragsteller: item?.antragsteller,
    status: item?.status,
    statusKategorie: item?.status ? getStatusCategory(item.status) : undefined,
    antragsdatum: item?.antragsdatum,
    bewilligungsdatum: item?.bewilligung_datum,
    laufzeitbeginn: item?.laufzeitbeginn,
    laufzeitende: item?.laufzeitende,
    ortAst: item?.ort_ast,
    zuwendung: typeof item?.foerdersumme === 'number' ? item.foerdersumme : undefined,
    vbPhase: item?.vb_phase,
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
    unterprogramm: linkedItem?.unterprogramm_id?.trim() || undefined,
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
    return await embedQueryCached(query, cfg, 'query');
  } catch {
    return null;
  }
}

export function useUnifiedSearch(query: string): UseUnifiedSearchResult {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const programme = useActiveProgramm(s => s.programme);
  const { vectorReady, documentCount } = useSearch();
  // v2.62.1: Opt-in-Modus der Ähnlichkeitssuche abonnieren, damit das
  // Umschalten im Dropdown die LAUFENDE Suche neu ausführt — sonst bleiben
  // die angezeigten Treffer Substring-only bis zur nächsten Query-Änderung.
  const semanticEnabled = useSemanticSearchMode(s => s.enabled);
  // Code→Name-Map der Unterprogramme des aktiven Programms (Modul-gecacht).
  // Die Suche ist immer auf EIN Programm gescoped, daher genuegt eine Map.
  const unterprogrammLabels = useUnterprogrammLabels(activeProgrammId);

  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [antraegeGeladen, setAntraegeGeladen] = useState(0);
  const [searchPhase, setSearchPhase] = useState<SearchPhase>('idle');
  const [semanticStatus, setSemanticStatus] = useState<SemanticStatus>(null);

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

  // Streaming-Hauptsuche. Drei Stages emittieren progressiv `setResults`,
  // damit der User schon erste Treffer sieht waehrend die Embedding-Pipeline
  // noch laeuft. Pattern:
  //   Stage 1 (substring) — sync, ~10ms, gibt sofort 1.0-Score-Hits
  //   Stage 2 (vector)    — async, ~200ms, ergaenzt cosine-Hits
  //   Stage 3 (orama)     — sync, ~150-300ms, ergaenzt Dokument-Treffer + DMS
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      setSearchPhase('idle');
      setSemanticStatus(null);
      return;
    }
    setSemanticStatus(null);

    const abort = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      void (async () => {
        const merged = new Map<string, UnifiedSearchResult>();
        const tStart = performance.now();

        function isCancelled(): boolean {
          return cancelled || abort.signal.aborted;
        }

        function emit(): void {
          if (isCancelled()) return;
          setResults(Array.from(merged.values()).sort((a, b) => b.score - a.score));
        }

        function upsertAntrag(
          hit: AntragSearchHit,
          byAkz: Map<string, AntragListItem>,
        ): void {
          const key = `antrag:${hit.aktenzeichen}`;
          const next = mapAntragHit(hit, byAkz.get(hit.aktenzeichen), programmNameById);
          const prev = merged.get(key);
          if (!prev || next.score > prev.score) merged.set(key, next);
        }

        try {
          // Stage 0: Caches laden (idR warm wegen Mount-Preload in SuchSeite).
          setSearchPhase('substring');
          const [listCache, programmCaches] = activeProgrammId
            ? await Promise.all([
                getAntraegeListCache(storage.idb, activeProgrammId),
                getProgrammCaches(storage.idb, activeProgrammId).catch(() => null),
              ])
            : [null, null];
          if (isCancelled()) return;

          const byAkz = listCache?.byAkz ?? new Map<string, AntragListItem>();
          const filenameToAkz = programmCaches?.filenameToAkz ?? new Map<string, string>();

          // Stage 1: Substring (sync) — sofort sichtbare Treffer.
          if (programmCaches) {
            const tStage1 = performance.now();
            const subAkz = searchAntraegeSubstring(q, programmCaches.textCorpus);
            for (const akz of subAkz) {
              upsertAntrag({ aktenzeichen: akz, score: 1.0, method: 'fulltext' }, byAkz);
            }
            pipelineLog.info('Suche', `Stage 1 (Substring): ${subAkz.length} Treffer in ${Math.round(performance.now() - tStage1)}ms`);
            emit();
          }
          if (isCancelled()) return;

          // Stage 2: Vector — Embedding berechnen, Cosine-Loop.
          setSearchPhase('vector');
          // Abonnierter Wert + zentrales Gate (Build-Flag): beides muss stehen.
          const semanticActive =
            semanticEnabled
            && isSemanticSearchActive()
            && q.length >= STREAMING_CONSTS.MIN_QUERY_LEN_FOR_SEMANTIC;

          // Diagnose-Logs hier bewusst via console.* (nicht pipelineLog — der
          // ist in Builds stumm): unter file:// ist das die einzige Spur, warum
          // die Ähnlichkeitssuche ggf. keine Treffer ergänzt (Pitfall #15-Klasse).
          let queryVec: number[] | null = null;
          if (semanticActive) {
            try {
              await ensureEmbeddingReady(storage.idb);
              if (isCancelled()) return;
              queryVec = await embedQueryIfReady(q, storage.idb);
              if (queryVec === null && !isCancelled()) {
                console.warn('[useUnifiedSearch] Ähnlichkeitssuche: Query-Embedding fehlgeschlagen (Modell nicht bereit / Embed-Fehler).');
                setSemanticStatus('model-failed');
              }
            } catch (err) {
              console.warn('[useUnifiedSearch] embedding init failed:', err);
              if (!isCancelled()) setSemanticStatus('model-failed');
            }
            if (isCancelled()) return;
          }

          if (queryVec && programmCaches) {
            try {
              const tStage2 = performance.now();
              const embeddings = await getEmbeddings(storage.idb);
              if (isCancelled()) return;
              if (embeddings.size === 0) {
                console.warn('[useUnifiedSearch] Ähnlichkeitssuche: Embedding-Korpus lokal leer (IDB) — keine Vector-Treffer möglich. Korpus kommt vom Daten-Share (Auslastungs-Modul / Auto-Download).');
                setSemanticStatus('corpus-empty');
              } else {
                const vecHits = await searchAntraegeVector(queryVec, embeddings, abort.signal);
                if (isCancelled()) return;
                for (const h of vecHits) {
                  upsertAntrag({ aktenzeichen: h.akz, score: h.score, method: 'vector' }, byAkz);
                }
                setSemanticStatus('ok');
                console.info(
                  `[useUnifiedSearch] Ähnlichkeitssuche: ${vecHits.length} Vector-Treffer (Korpus ${embeddings.size}) in ${Math.round(performance.now() - tStage2)}ms`,
                );
                emit();
              }
            } catch (err) {
              console.warn('[useUnifiedSearch] vector stage failed:', err);
            }
          }
          if (isCancelled()) return;

          // Stage 3: Orama — Dokumente + DMS-Antraege-Match.
          setSearchPhase('orama');
          const tStage3 = performance.now();
          const dokumenteHits: OramaSearchResult[] = getOramaDB() !== null
            ? hybridSearch(q, queryVec, { limit: DOC_HIT_LIMIT })
            : [];
          for (const h of dokumenteHits) {
            const r = mapDokumentHit(h, filenameToAkz, byAkz, programmNameById);
            const key = `${r.type}:${r.id}`;
            const prev = merged.get(key);
            if (!prev || r.score > prev.score) merged.set(key, r);
          }

          // DMS-Antraege-Match (via filenameToAkz aus Orama-Hits).
          if (programmCaches) {
            const dmsAntragHits = searchAntraegeDms(q, queryVec, programmCaches.filenameToAkz);
            for (const h of dmsAntragHits) {
              upsertAntrag({ aktenzeichen: h.akz, score: h.score, method: 'hybrid' }, byAkz);
            }
          }
          pipelineLog.info('Suche', `Stage 3 (Orama): ${dokumenteHits.length} Dok-Treffer in ${Math.round(performance.now() - tStage3)}ms`);
          emit();

          if (isCancelled()) return;
          setSearchPhase('done');
          setLoading(false);
          pipelineLog.info('Suche', `Pipeline gesamt: ${Math.round(performance.now() - tStart)}ms, ${merged.size} Treffer`);
        } catch (err) {
          if (isCancelled()) return;
          if ((err as Error).name === 'AbortError') return;
          console.warn('[useUnifiedSearch] failed:', err);
          setError((err as Error).message ?? 'Suche fehlgeschlagen');
          setResults([]);
          setSearchPhase('error');
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [query, activeProgrammId, storage, programmNameById, semanticEnabled]);

  const counts = useMemo<UnifiedSearchCounts>(() => {
    let antraege = 0;
    let dokumente = 0;
    for (const r of results) {
      if (r.type === 'antrag') antraege++;
      else dokumente++;
    }
    return { total: results.length, antraege, dokumente };
  }, [results]);

  // Unterprogramm-Code → sprechendes Label aufloesen (Fallback = Code). Bewusst
  // NACH der Streaming-Pipeline als reines Memo, damit der Effekt-Dep-Array
  // unberuehrt bleibt (kein zusaetzlicher Such-Re-Run/Flicker beim Label-Load).
  const resultsWithUnterprogramm = useMemo(() => {
    if (unterprogrammLabels.size === 0) return results;
    let changed = false;
    const out = results.map(r => {
      if (r.unterprogramm) {
        const label = unterprogrammLabels.get(r.unterprogramm);
        if (label && label !== r.unterprogramm) {
          changed = true;
          return { ...r, unterprogramm: label };
        }
      }
      return r;
    });
    return changed ? out : results;
  }, [results, unterprogrammLabels]);

  return {
    results: resultsWithUnterprogramm,
    loading,
    error,
    counts,
    indexInfo: { textabschnitteImIndex: documentCount, antraegeGeladen },
    vectorReady,
    searchPhase,
    semanticStatus,
  };
}
