import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  loadOramaFromDB, hybridSearch, insertDoc, removeDoc, getDocCount,
  type OramaSearchResult,
} from '@/core/services/search/orama-store';
import { embeddingService } from '@/core/services/search/embedding-service';
import { getActiveModelId, getModelById } from '@/core/services/search/model-registry';
import type { EmbeddingModelConfig } from '@/core/services/search/model-registry';
import type { StorageService } from '@/core/services/storage';

interface SearchContextValue {
  search: (query: string, filters?: { type?: string }) => Promise<void>;
  results: OramaSearchResult[];
  loading: boolean;
  vectorReady: boolean;
  vectorLoading: boolean;
  indexDocument: (doc: {
    id: string; text: string; title: string; source: string; tags: string[]; type: string;
  }) => void;
  removeDocument: (id: string) => void;
  documentCount: number;
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

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
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
        const synced = await syncDocumentsFromFileServer(storage);
        if (synced > 0) console.log(`${synced} Dokumente vom File Server synchronisiert`);
      } catch { /* kein File Server */ }

      // Orama-Index aus IDB laden (entweder lokal oder gerade vom Server ueberschrieben)
      await loadOramaFromDB(storage.idb);
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
    })();
  }, [storage]);

  const search = useCallback(async (query: string, filters?: { type?: string }) => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      let queryVector: number[] | null = null;
      if (embeddingService.isReady() && modelConfigRef.current) {
        queryVector = await embeddingService.embedSingle(
          query, modelConfigRef.current, 'query',
        );
      }
      const r = hybridSearch(query, queryVector, { type: filters?.type });
      setResults(r);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const indexDocument = useCallback((doc: {
    id: string; text: string; title: string; source: string; tags: string[]; type: string;
  }) => {
    const dims = modelConfigRef.current?.dimensions ?? 384;
    const emptyVec = new Array(dims).fill(0) as number[];
    insertDoc({ ...doc, tags: doc.tags.join(','), embedding: emptyVec });
    setDocCount(getDocCount());
  }, []);

  const removeDocument = useCallback((id: string) => {
    removeDoc(id);
    setDocCount(getDocCount());
  }, []);

  return { search, results, loading, vectorReady, vectorLoading, indexDocument, removeDocument, documentCount: docCount };
}
