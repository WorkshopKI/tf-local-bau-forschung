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
import type { StorageService } from '@/core/services/storage';
import { loadAllEmbeddings } from '@/core/services/embedding-corpus';
import { buildAntraegeIndexForMatching } from '../services/embedding-matcher';
import { ensureAntragCorpus } from '../services/corpus-share-sync';
import { useAuslastungCorpusSignal } from '../services/corpus-signal';

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
  storage: StorageService,
): () => Promise<MatchingCorpus> {
  const cacheRef = useRef<{ key: Antrag[]; value: MatchingCorpus } | null>(null);
  const inflightRef = useRef<{ key: Antrag[]; promise: Promise<MatchingCorpus> } | null>(null);

  // v2.29.1/.2: Korpus-Signal — wird der per-Antrag-Korpus extern in die IDB
  // geschrieben (Start-Autoload / „Vom Datenspeicher laden" / „Corpus aufbauen"),
  // ändert sich die `antraege`-Referenz NICHT → der Cache-Key bliebe gleich und
  // `loadCorpus` lieferte den (leeren) Stand von vor dem Download weiter, bis zum
  // Browser-Reload. `corpusVersion` in den useCallback-Deps gibt `loadCorpus` bei
  // jedem Bump eine neue Identität → Konsumenten, die `loadCorpus` in ihren
  // Effekt-Deps führen (Zuweisungs-Cockpit-Matching), re-matchen die aktuelle
  // Selektion automatisch (v2.29.2). Den Cache verwirft der Callback selbst —
  // ordering-unabhängig statt über einen separaten Effekt.
  const corpusVersion = useAuslastungCorpusSignal(s => s.version);
  const cachedVersionRef = useRef(corpusVersion);

  return useCallback(async (): Promise<MatchingCorpus> => {
    // Externe Korpus-Mutation seit dem letzten Load → Cache + Inflight verwerfen.
    if (cachedVersionRef.current !== corpusVersion) {
      cachedVersionRef.current = corpusVersion;
      cacheRef.current = null;
      inflightRef.current = null;
    }
    if (cacheRef.current && cacheRef.current.key === antraege) {
      return cacheRef.current.value;
    }
    // Laufenden Load fuer denselben Korpus-Stand wiederverwenden (Dedup).
    if (inflightRef.current && inflightRef.current.key === antraege) {
      return inflightRef.current.promise;
    }
    const promise = (async (): Promise<MatchingCorpus> => {
      // Selbstheilung (v2.19): auf einem neuen Rechner ist der per-Antrag-Korpus
      // lokal leer → vom Share laden (falls kompatibel + Antrags-Stand passt),
      // bevor er aus der IDB gelesen wird. Sonst lieferte das Matching ohne
      // Embedding-Anteil — Kompetenz wirkte „nicht verknüpft".
      await ensureAntragCorpus(storage, antraege);
      const corpusEmbeddings = await loadAllEmbeddings(storage.idb);
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
  }, [antraege, storage, corpusVersion]);
}
