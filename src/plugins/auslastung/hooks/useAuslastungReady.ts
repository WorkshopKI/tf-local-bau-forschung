/**
 * useAuslastungReady (v2.7) — zentraler Loading-State fuer das Auslastungs-Modul.
 *
 * Aggregiert die zwei Master-Daten-Quellen:
 *  - `useAntraegeCache`: IDB-Read der Antraege (~1-2s bei 5k+ Records)
 *  - `useAuslastungData`: Auslastungs-Store (Klassifizierungen, Zuweisungen, Config)
 *
 * Sub-Loadings (z.B. Embedding-Corpus in `KlassifizierungsReview`) bleiben
 * lokal — die werden als sekundaere Hinweise gerendert, sobald die Master-
 * Daten da sind.
 *
 * Konsumenten zeigen waehrend `!ready`:
 *  - Skeleton-Zeilen in Tabellen
 *  - Counts als „…" statt 0
 *  - Aktions-Buttons disabled
 */
import { useAntraegeCache } from './useAntraegeCache';
import { useAuslastungData } from './useAuslastungData';

export interface AuslastungReady {
  /** True wenn beide Master-Quellen geladen sind. */
  ready: boolean;
  /** Welche Quelle haengt noch — fuer UI-Status-Text. */
  loading: {
    antraege: boolean;
    auslastung: boolean;
  };
}

export function useAuslastungReady(): AuslastungReady {
  const cache = useAntraegeCache();
  const auslastungLoaded = useAuslastungData(s => s.loaded);

  // v2.63: zusaetzlich auf die Stream-Passage warten (aggregatesLoaded) —
  // sonst laufen Matching/Klassifizierung kurz mit leeren historische*-Maps
  // (Bug-Klasse v2.46.1: „Keine passenden MAs" direkt nach Cold-Start).
  const antraegeBusy = cache.loading || !cache.loaded || !cache.aggregatesLoaded;
  const auslastungBusy = !auslastungLoaded;

  return {
    ready: !antraegeBusy && !auslastungBusy,
    loading: {
      antraege: antraegeBusy,
      auslastung: auslastungBusy,
    },
  };
}
