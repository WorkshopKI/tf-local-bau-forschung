import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  loadOramaFromDB, loadDocChunkCounts, hybridSearch, insertDoc, removeDoc, getDocCount,
  ensureOramaDB, saveOramaDimensions, persistOramaSoon,
  type OramaSearchResult,
} from '@/core/services/search/orama-store';
import { embeddingService } from '@/core/services/search/embedding-service';
import { embedQueryCached } from '@/core/services/search/query-embedder';
import { getActiveModelId, getModelById, DEFAULT_MODEL_ID } from '@/core/services/search/model-registry';
import { initReRanker, isReRankerReady, rerank, disposeReRanker } from '@/core/services/search/re-ranker'; // PHASE 2: Re-Ranker
import type { EmbeddingModelConfig } from '@/core/services/search/model-registry';
import type { StorageService } from '@/core/services/storage';
import { pipelineLog } from '@/core/services/search/pipeline-logger';

interface SearchContextValue {
  /** Setzt `results` UND gibt sie zurück — Rückgabewert nutzen, wenn die
   *  Ergebnisse direkt nach dem await gebraucht werden (React-State wäre
   *  im selben Callback noch der alte Stand, z.B. Chat-RAG). */
  search: (query: string, filters?: { type?: string }) => Promise<OramaSearchResult[]>;
  results: OramaSearchResult[];
  loading: boolean;
  vectorReady: boolean;
  vectorLoading: boolean;
  /** Legt einen fehlenden Index selbst an und persistiert nachlaufend. Wirft nur,
   *  wenn Orama den Datensatz ablehnt — der Aufrufer entscheidet dann, ob das die
   *  Aufnahme scheitern lässt (tut es in der Dokumentablage bewusst NICHT). */
  indexDocument: (doc: {
    id: string; text: string; title: string; source: string; tags: string[]; type: string;
  }) => Promise<void>;
  removeDocument: (id: string) => void;
  documentCount: number;
  toggleReRanker: (enable: boolean, modelId?: string) => Promise<void>;
}

export const SearchContext = createContext<SearchContextValue | null>(null);

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
}

export function useSearchProvider(storage: StorageService): SearchContextValue {
  const [results, setResults] = useState<OramaSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [vectorReady, setVectorReady] = useState(false);
  const [vectorLoading, setVectorLoading] = useState(false);
  const modelConfigRef = useRef<EmbeddingModelConfig | null>(null);
  const initRef = useRef(false);
  /** Promise des Init-Laufs. `indexDocument` wartet darauf: vorher steht weder die
   *  Vektor-Dimension fest (Insert mit falscher Vektorlänge) noch ist klar, ob aus
   *  IDB/Share ein Index nachkommt (den die Lazy-Anlage sonst verdrängen würde).
   *  Der `catch` hält das Promise erfüllbar — ein gescheiterter Init darf die Ablage
   *  nicht mitreißen, sie legt dann eben einen frischen Index an. */
  const initDoneRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    initDoneRef.current = (async () => {
      const modelId = await getActiveModelId(storage.idb);
      const modelConfig = getModelById(modelId);
      modelConfigRef.current = modelConfig;

      // Pruefe ob File Server einen neueren Index hat
      try {
        const { loadIndexFromFileServer } = await import('@/core/services/search/index-persistence');
        await loadIndexFromFileServer(storage);
      } catch { /* kein File Server */ }

      // Dokumente vom File Server synchronisieren (fehlende lokal laden)
      try {
        const { syncDocumentsFromFileServer } = await import('@/core/services/search/document-scanner');
        await syncDocumentsFromFileServer(storage);
      } catch { /* kein File Server */ }

      // Orama-Index aus IDB laden (entweder lokal oder gerade vom Server ueberschrieben)
      const loaded = await loadOramaFromDB(storage.idb, modelConfig.dimensions);
      if (loaded) {
        pipelineLog.info('Suche', `Index geladen: ${getDocCount()} Dokumente`);
      } else {
        pipelineLog.warn('Suche', 'Kein Index vorhanden');
      }
      // Chunk-Counts laden (für Score-Normalisierung langer Dokumente)
      try { await loadDocChunkCounts(storage.idb); } catch { /* erste Nutzung */ }
      setDocCount(getDocCount());

      // Embedding-Modell im Hintergrund laden
      setVectorLoading(true);
      let gpuAvailable = false;
      if ('gpu' in navigator) {
        try {
          const adapter = await (navigator as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter();
          gpuAvailable = !!adapter;
        } catch { /* no GPU */ }
      }

      try {
        await embeddingService.init(modelConfig, gpuAvailable);
        setVectorReady(true);
      } catch { /* Kein Embedding — Fulltext-Only */ }
      finally { setVectorLoading(false); }

      // Re-Ranker nur laden wenn in pipeline-config aktiviert
      const pipelineCfg = await storage.idb.get<{ useReRanker?: boolean; reRankerModelId?: string }>('pipeline-config');
      if (pipelineCfg?.useReRanker) {
        try {
          const reRankerModel = pipelineCfg.reRankerModelId ?? 'bge-reranker-base';
          const loaded = await initReRanker(reRankerModel);
          if (loaded) pipelineLog.info('Re-Ranker', 'Bereit');
          else pipelineLog.warn('Re-Ranker', 'Konnte nicht geladen werden');
        } catch (err) {
          pipelineLog.warn('Re-Ranker', `Fehler: ${err}`);
        }
      }
    })().catch(err => { pipelineLog.warn('Suche', `Initialisierung fehlgeschlagen: ${err}`); });
  }, [storage]);

  const search = useCallback(async (query: string, filters?: { type?: string }): Promise<OramaSearchResult[]> => {
    if (!query.trim()) { setResults([]); return []; }
    setLoading(true);
    const t0 = performance.now();
    try {
      let queryVector: number[] | null = null;
      if (embeddingService.isReady() && modelConfigRef.current) {
        queryVector = await embedQueryCached(
          query, modelConfigRef.current, 'query',
        );
        pipelineLog.info('Embedding', `Query embedden mit ${modelConfigRef.current.label} — ${queryVector.length}d`);
      } else {
        pipelineLog.warn('Embedding', 'Nicht bereit — nur BM25 Fulltext-Suche');
      }
      const reRankerActive = isReRankerReady();
      const stage1Limit = reRankerActive ? 30 : undefined;
      const stage1 = hybridSearch(query, queryVector, { type: filters?.type, limit: stage1Limit });
      pipelineLog.info('Orama', `${queryVector ? 'Hybrid' : 'Fulltext'}-Suche: ${stage1.length} Ergebnisse`);
      const r = reRankerActive ? await rerank(query, stage1, 15, 10) : stage1;
      if (reRankerActive) pipelineLog.info('Re-Ranker', `${stage1.length} → ${r.length} Ergebnisse`);
      setResults(r);
      pipelineLog.searchSummary({
        query,
        embeddingModel: modelConfigRef.current?.label ?? 'keins',
        vectorReady: !!queryVector,
        reRankerActive,
        stage1Results: stage1.length,
        stage2Results: reRankerActive ? r.length : undefined,
        totalTimeMs: Math.round(performance.now() - t0),
      });
      return r;
    } catch (err) { pipelineLog.warn('Suche', `Fehler: ${err}`); setResults([]); return []; }
    finally { setLoading(false); }
  }, []);

  const indexDocument = useCallback(async (doc: {
    id: string; text: string; title: string; source: string; tags: string[]; type: string;
  }): Promise<void> => {
    await initDoneRef.current;
    const dims = modelConfigRef.current?.dimensions ?? getModelById(DEFAULT_MODEL_ID).dimensions;
    // Fehlt der Index komplett (frische Variant-IDB, nie ein Vollindexlauf gelaufen,
    // nichts vom Share), legt die Ablage ihn selbst an — sonst wäre in prod/pl ohne
    // Kurator-Rolle nie ein Dokument ablegbar. Der Vektor bleibt null; echte
    // Embeddings entstehen erst beim nächsten Vollindexlauf.
    if (ensureOramaDB(dims)) await saveOramaDimensions(storage.idb, dims);
    const emptyVec = new Array(dims).fill(0) as number[];
    insertDoc({ ...doc, tags: doc.tags.join(','), embedding: emptyVec });
    setDocCount(getDocCount());
    persistOramaSoon(storage.idb);
  }, [storage]);

  const removeDocument = useCallback((id: string) => {
    removeDoc(id);
    setDocCount(getDocCount());
    persistOramaSoon(storage.idb);
  }, [storage]);

  const toggleReRanker = useCallback(async (enable: boolean, modelId?: string) => {
    if (enable) {
      const id = modelId ?? 'bge-reranker-base';
      const loaded = await initReRanker(id);
      if (loaded) pipelineLog.info('Re-Ranker', 'Bereit');
      else pipelineLog.warn('Re-Ranker', 'Konnte nicht geladen werden');
    } else {
      disposeReRanker();
    }
  }, []);

  return { search, results, loading, vectorReady, vectorLoading, indexDocument, removeDocument, documentCount: docCount, toggleReRanker };
}
