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
  isSemanticSearchActive,
} from './services/antraege-search-service';
import { ensureEmbeddingReady } from '@/core/services/embedding-corpus';
import { useSemanticSearchMode } from '@/core/hooks/useSemanticSearchMode';

/** Re-export fuer Konsumenten die den Mirror-Status verarbeiten (Banner-UI). */
export type { MirrorBootstrapStatus } from './services/antraege-search-service';

const DEBOUNCE_MS = 500;

export function useAntraegeHybridSearch(): void {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const search = useAntraegeStore(s => s.search);
  const setHybridSearch = useAntraegeStore(s => s.setHybridSearch);
  // Die Leitbegriffe einer Frage ersetzen die Zerlegung der Eingabe. Als Hook
  // abonniert, damit eine neue Frage die laufende Suche neu ausfuehrt.
  const planTeile = useAntraegeStore(s => s.planTeile);
  // v2.62: Opt-in-Schalter der Ähnlichkeitssuche. Als Hook abonniert, damit das
  // Umschalten im Dropdown den Preload-Effekt sofort re-triggert.
  const semanticEnabled = useSemanticSearchMode(s => s.enabled);

  // Caches bei Programm-Switch invalidieren.
  const prevProgrammRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevProgrammRef.current !== null && prevProgrammRef.current !== activeProgrammId) {
      clearAntraegeSearchCaches();
    }
    prevProgrammRef.current = activeProgrammId;
  }, [activeProgrammId]);

  // Background-Preload. Der Substring-Korpus laedt immer (billig, traegt die
  // Default-Suche). Stage 2 (Modell-Init + Mirror-Bootstrap + Embedding-Map)
  // laeuft seit v2.62 NUR nach Opt-in „Mit Ähnlichkeitssuche" — und dann sofort
  // statt im Idle-Window: das Umschalten ist eine explizite User-Aktion, der
  // Lade-Hinweis (downloadingCorpus-Banner) ueberbrueckt die Wartezeit.
  useEffect(() => {
    if (!activeProgrammId) return;
    let cancelled = false;
    void (async () => {
      try {
        await getProgrammCaches(storage.idb, activeProgrammId);
        if (cancelled) return;
        // Abonnierter Wert + zentrales Gate (Build-Flag): beides muss stehen.
        if (!semanticEnabled || !isSemanticSearchActive()) return;

        ensureEmbeddingReady(storage.idb).catch(err => {
          console.warn('[useAntraegeHybridSearch] preload embedding model failed:', err);
        });
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
      } catch (err) {
        if (cancelled) return;
        console.warn('[useAntraegeHybridSearch] preload corpus failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProgrammId, storage, setHybridSearch, semanticEnabled]);

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
            ...(planTeile ? { planTeile } : {}),
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
    // semanticEnabled in den Deps: das Dropdown-Umschalten führt die laufende
    // Suche neu aus (searchAntraege liest den Modus zur Laufzeit) — sonst
    // blieben die angezeigten Treffer bis zur nächsten Eingabe Substring-only.
  }, [search, activeProgrammId, storage, setHybridSearch, semanticEnabled, planTeile]);
}
