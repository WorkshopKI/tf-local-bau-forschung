import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { FulltextSearch } from '@/core/services/search/fulltext';
import type { SearchResult, SearchDoc } from '@/core/services/search/fulltext';
import type { StorageService } from '@/core/services/storage';

interface SearchContextValue {
  search: (query: string, filters?: { type?: string }) => void;
  results: SearchResult[];
  loading: boolean;
  indexDocument: (doc: SearchDoc) => void;
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
  const fulltextRef = useRef(new FulltextSearch());
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initRef = useRef(false);

  // Load index from IDB on first use
  if (!initRef.current) {
    initRef.current = true;
    storage.idb.get<string>('search-index').then(json => {
      if (json) {
        try {
          fulltextRef.current.importIndex(json);
          setDocCount(fulltextRef.current.getDocumentCount());
        } catch {
          // Corrupted index, start fresh
        }
      }
    });
  }

  const persistIndex = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const json = fulltextRef.current.exportIndex();
      storage.idb.set('search-index', json);
    }, 5000);
  }, [storage]);

  const search = useCallback((query: string, filters?: { type?: string }) => {
    setLoading(true);
    const r = fulltextRef.current.search(query, filters);
    setResults(r);
    setLoading(false);
  }, []);

  const indexDocument = useCallback((doc: SearchDoc) => {
    fulltextRef.current.addDocument(doc);
    setDocCount(fulltextRef.current.getDocumentCount());
    persistIndex();
  }, [persistIndex]);

  const removeDocument = useCallback((id: string) => {
    fulltextRef.current.removeDocument(id);
    setDocCount(fulltextRef.current.getDocumentCount());
    persistIndex();
  }, [persistIndex]);

  return { search, results, loading, indexDocument, removeDocument, documentCount: docCount };
}
