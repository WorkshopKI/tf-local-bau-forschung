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
import { useKorpusLadeStatus } from './useKorpusLadeStatus';

/**
 * Was gerade laedt — EINE Quelle fuer den Ladezustand des Moduls (v2.352).
 * `null` = nichts haengt.
 */
export type LadePhase = 'auslastungsdaten' | 'antraege' | 'themenvektoren';

export interface AuslastungReady {
  /** True wenn beide Master-Quellen geladen sind. */
  ready: boolean;
  /** Welche Quelle haengt noch — fuer UI-Status-Text. */
  loading: {
    antraege: boolean;
    auslastung: boolean;
  };
  /** Genau eine Phase (oder null) fuer die Anzeige — siehe `bestimmeLadePhase`. */
  phase: LadePhase | null;
}

/**
 * Praezedenz der Lade-Phasen: die Auslastungsdaten (SMB-Sidecar) kommen zuerst,
 * dann die Antraege (IDB + Stream-Artefakte), zuletzt der Themen-Vektor-Korpus.
 * Rein, damit die Reihenfolge ohne React testbar bleibt.
 */
export function bestimmeLadePhase(input: {
  auslastungBusy: boolean;
  antraegeBusy: boolean;
  korpusBusy: boolean;
}): LadePhase | null {
  if (input.auslastungBusy) return 'auslastungsdaten';
  if (input.antraegeBusy) return 'antraege';
  if (input.korpusBusy) return 'themenvektoren';
  return null;
}

export function useAuslastungReady(): AuslastungReady {
  const cache = useAntraegeCache();
  const auslastungLoaded = useAuslastungData(s => s.loaded);
  const korpusBusy = useKorpusLadeStatus(s => s.laden);

  // v2.63: zusaetzlich auf die Stream-Passage warten (aggregatesLoaded) —
  // sonst laufen Matching/Klassifizierung kurz mit leeren historische*-Maps
  // (Bug-Klasse v2.46.1: „Keine passenden MAs" direkt nach Cold-Start).
  const antraegeBusy = cache.loading || !cache.loaded || !cache.aggregatesLoaded;
  const auslastungBusy = !auslastungLoaded;

  return {
    // Der Korpus geht BEWUSST nicht in `ready` ein: ein Download vom Datenspeicher
    // kann Minuten dauern, waehrenddessen ist die Seite voll bedienbar (leere
    // Themen-Vorschlaege statt gesperrter Oberflaeche).
    ready: !antraegeBusy && !auslastungBusy,
    loading: {
      antraege: antraegeBusy,
      auslastung: auslastungBusy,
    },
    phase: bestimmeLadePhase({ auslastungBusy, antraegeBusy, korpusBusy }),
  };
}
