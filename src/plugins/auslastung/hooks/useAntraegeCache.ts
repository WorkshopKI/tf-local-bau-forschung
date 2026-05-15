/**
 * Laedt einmalig alle Antraege des aktiven Programms in den Speicher.
 *
 * Anders als der `dokument-review`-Hook nutzen wir hier den vollen
 * `Antrag`-Record (nicht das Slim-AntragListItem), weil wir die
 * Deskriptoren-Spalten (`techn_1..5`, `branche..5`, `anwendung_1..2`) und
 * den Abstract (`projektbeschreibung_text`) brauchen. Bei 5000 Antraegen
 * ist das ~180 MB unkomprimiert, aber IDB liest streamend — typische Load
 * Zeit ~1-2 s. Wird einmal beim Tab-Wechsel oder Programm-Switch gecached.
 */
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import type { Antrag } from '@/core/services/csv/types';
import { buildAnonymMap, type AnonymMap } from '../services/anonym-map';
import { aggregateMaProfilesByAnon, collectAllDeskriptorenMitCount } from '../services/profil-aggregator';

interface AntraegeCache {
  antraege: Antrag[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  anonymMap: AnonymMap;
  historischeDeskriptorenByAnon: Map<string, string[]>;
  allDeskriptoren: Array<{ wert: string; count: number }>;
  refresh: () => Promise<void>;
}

export function useAntraegeCache(): AntraegeCache {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!activeProgrammId) {
      setAntraege([]);
      setLoaded(true);
      return;
    }
    setLoading(true);
    try {
      const all = await listAntraegeByProgramm(storage.idb, activeProgrammId);
      setAntraege(all);
      setLoaded(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [storage, activeProgrammId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const anonymMap = useMemo(() => buildAnonymMap(antraege), [antraege]);
  const historischeDeskriptorenByAnon = useMemo(
    () => aggregateMaProfilesByAnon(antraege, anonymMap),
    [antraege, anonymMap],
  );
  const allDeskriptoren = useMemo(
    () => collectAllDeskriptorenMitCount(antraege),
    [antraege],
  );

  return {
    antraege,
    loading,
    loaded,
    error,
    anonymMap,
    historischeDeskriptorenByAnon,
    allDeskriptoren,
    refresh,
  };
}
