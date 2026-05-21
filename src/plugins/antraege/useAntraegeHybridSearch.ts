/**
 * Mount-once-Hook fuer `AntraegePage`. Schreibt das Ergebnis der
 * Antrags-Hybrid-Suche in den `AntraegeStore` (`setHybridSearch`).
 *
 * Die eigentliche Such-Pipeline (Substring + Embedding + DMS) wohnt in
 * [services/antraege-search-service.ts](services/antraege-search-service.ts).
 * Hier nur:
 *  - Debounce (500 ms) auf den Suchstring
 *  - Sofortiges Substring-Vorab-Result (< 100 ms Tipp-Feedback)
 *  - Cache-Invalidation bei Programm-Switch
 *  - Background-Preload in zwei Stufen (Programm-Caches sofort, Mirror-
 *    Bootstrap + Embedding-Map im naechsten Idle-Window)
 *  - Mapping `AntragSearchHit[]` → `Set<aktenzeichen>` fuer den Store-State.
 */
import { useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { useAntraegeStore } from './store';
import {
  searchAntraege,
  getProgrammCaches,
  getEmbeddings,
  clearAntraegeSearchCaches,
  invalidateEmbeddingsCache,
  autoBootstrapEmbeddingMirror,
} from './services/antraege-search-service';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { features } from '@/config/feature-flags';

/** Re-export fuer Konsumenten die den Mirror-Status verarbeiten (Banner-UI). */
export type { MirrorBootstrapStatus } from './services/antraege-search-service';

const DEBOUNCE_MS = 500;

/** Identisch zu `SEMANTIC_SOURCES_ENABLED` im Service — wir entscheiden hier
 *  ob die Idle-Stage-2 (Modell-Init + Korpus-Download) ueberhaupt anlaeuft. */
const SEMANTIC_SOURCES_ENABLED =
  features.volltextsuche === true
  || features.auslastung === true
  || features.dokumentenscan === true
  || features.suche === true;

/** Schedule a callback im naechsten Idle-Window. Fallback `setTimeout(0)` in
 *  Browsern ohne `requestIdleCallback` (Safari < 16.4). */
function scheduleIdle(cb: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(cb, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 0);
  return () => window.clearTimeout(id);
}

export function useAntraegeHybridSearch(): void {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const search = useAntraegeStore(s => s.search);
  const setHybridSearch = useAntraegeStore(s => s.setHybridSearch);

  // Caches bei Programm-Switch invalidieren.
  const prevProgrammRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevProgrammRef.current !== null && prevProgrammRef.current !== activeProgrammId) {
      clearAntraegeSearchCaches();
    }
    prevProgrammRef.current = activeProgrammId;
  }, [activeProgrammId]);

  // Background-Preload.
  useEffect(() => {
    if (!activeProgrammId) return;
    let cancelled = false;
    let cancelIdle: (() => void) | null = null;
    void (async () => {
      try {
        await getProgrammCaches(storage.idb, activeProgrammId);
        if (cancelled) return;
        if (!SEMANTIC_SOURCES_ENABLED) return;

        cancelIdle = scheduleIdle(() => {
          if (cancelled) return;
          ensureEmbeddingReady(storage.idb).catch(err => {
            console.warn('[useAntraegeHybridSearch] preload embedding model failed:', err);
          });
          void (async () => {
            try {
              await autoBootstrapEmbeddingMirror(storage, status => {
                if (cancelled) return;
                if (status === 'downloading' || status === 'applying') {
                  setHybridSearch({ downloadingCorpus: true });
                } else {
                  setHybridSearch({ downloadingCorpus: false });
                }
                console.info('[antraege-search] mirror bootstrap:', status);
              });
            } catch (err) {
              if (!cancelled) setHybridSearch({ downloadingCorpus: false });
              console.warn('[useAntraegeHybridSearch] mirror bootstrap failed:', err);
            }
            if (cancelled) return;
            // Modul-Cache invalidieren falls der Bootstrap frische Vektoren
            // in IDB geschrieben hat — sonst wuerde `getEmbeddings()` noch
            // die alte (leere) Map cachen.
            invalidateEmbeddingsCache();
            getEmbeddings(storage.idb).catch(err => {
              console.warn('[useAntraegeHybridSearch] preload embeddings failed:', err);
            });
          })();
        });
      } catch (err) {
        if (cancelled) return;
        console.warn('[useAntraegeHybridSearch] preload corpus failed:', err);
      }
    })();
    return () => {
      cancelled = true;
      cancelIdle?.();
    };
  }, [activeProgrammId, storage, setHybridSearch]);

  // Suche auf Tipp-Eingabe.
  useEffect(() => {
    const q = search.trim();
    if (!q || !activeProgrammId) {
      setHybridSearch({ matchedAkz: null, loading: false, unavailable: [] });
      return;
    }

    const abort = new AbortController();
    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      setHybridSearch({ matchedAkz: null, loading: true, unavailable: [] });
      void (async () => {
        try {
          const result = await searchAntraege({
            query: q,
            idb: storage.idb,
            programmId: activeProgrammId,
            abortSignal: abort.signal,
          });
          if (cancelled || abort.signal.aborted) return;
          const matchedAkz = new Set(result.hits.map(h => h.aktenzeichen));
          setHybridSearch({
            matchedAkz,
            loading: false,
            unavailable: result.unavailable,
          });
        } catch (err) {
          if (cancelled || abort.signal.aborted) return;
          if ((err as Error).name === 'AbortError') return;
          console.warn('[useAntraegeHybridSearch] failed:', err);
          setHybridSearch({ matchedAkz: new Set(), loading: false, unavailable: [] });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [search, activeProgrammId, storage, setHybridSearch]);
}
