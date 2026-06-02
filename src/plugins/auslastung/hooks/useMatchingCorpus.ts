/**
 * useMatchingCorpus — cached den teuren, selektions-unabhaengigen Teil des
 * Stage-2-Matchings: den Embedding-Korpus (aus IDB) + den Antraege-Index.
 *
 * Hintergrund: Das Zuweisungs-Cockpit hat frueher pro Antrag-Klick
 * `loadAllEmbeddings()` (N IDB-Roundtrips) **und** `buildAntraegeIndexForMatching()`
 * (voller O(n)-Rebuild) neu ausgefuehrt — beide haengen aber nur an den
 * geladenen Antraegen, nicht am selektierten Antrag. Das verursachte 2-3 s
 * Latenz pro Klick.
 *
 * Cache-Key = die `antraege`-Array-Referenz (aus dem Cache-Store ref-stabil bis
 * zum naechsten Daten-Reload, gleiche Philosophie wie die v2.13-Store-Aggregate,
 * siehe docs/agents/optimize-remount-latency.md). Bei gleichem Stand kommt das
 * gecachte `{ corpusEmbeddings, antraegeIndex }` zurueck — kein IDB-Zugriff,
 * kein Index-Rebuild. Parallele Aufrufe fuer denselben Stand teilen sich einen
 * laufenden Load (`inflightRef`).
 */
import { useCallback, useRef } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { loadAllEmbeddings } from '@/core/services/embedding-corpus';
import { buildAntraegeIndexForMatching } from '../services/embedding-matcher';

export interface MatchingCorpus {
  corpusEmbeddings: Map<string, number[]>;
  antraegeIndex: ReturnType<typeof buildAntraegeIndexForMatching>;
}

/**
 * Liefert eine stabile `loadCorpus()`-Funktion, die den Korpus + Index einmal
 * pro `antraege`-Stand laedt/baut und danach aus dem Cache bedient.
 */
export function useMatchingCorpus(
  antraege: Antrag[],
  idb: IDBStore,
): () => Promise<MatchingCorpus> {
  const cacheRef = useRef<{ key: Antrag[]; value: MatchingCorpus } | null>(null);
  const inflightRef = useRef<{ key: Antrag[]; promise: Promise<MatchingCorpus> } | null>(null);

  return useCallback(async (): Promise<MatchingCorpus> => {
    if (cacheRef.current && cacheRef.current.key === antraege) {
      return cacheRef.current.value;
    }
    // Laufenden Load fuer denselben Korpus-Stand wiederverwenden (Dedup).
    if (inflightRef.current && inflightRef.current.key === antraege) {
      return inflightRef.current.promise;
    }
    const promise = (async (): Promise<MatchingCorpus> => {
      const corpusEmbeddings = await loadAllEmbeddings(idb);
      const antraegeIndex = buildAntraegeIndexForMatching(antraege);
      const value: MatchingCorpus = { corpusEmbeddings, antraegeIndex };
      cacheRef.current = { key: antraege, value };
      return value;
    })();
    inflightRef.current = { key: antraege, promise };
    try {
      return await promise;
    } finally {
      // Nur den eigenen Inflight-Eintrag aufraeumen (ein neuerer darf bleiben).
      if (inflightRef.current?.promise === promise) inflightRef.current = null;
    }
  }, [antraege, idb]);
}
