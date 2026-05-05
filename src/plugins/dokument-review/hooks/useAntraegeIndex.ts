/**
 * Laedt einmal alle Antraege des aktiven Programms in den RAM und liefert
 * einen einfachen Substring-Filter zurueck. Reicht fuer 5k–20k Antraege
 * (CSV-Import-Skala). AntragAutocomplete und Quick-Picks im DetailPanel
 * konsumieren dieses Index.
 */
import { useCallback, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import type { Antrag } from '@/core/services/csv/types';

interface AntraegeIndexState {
  antraege: Antrag[];
  loading: boolean;
  load: (programmId: string) => Promise<void>;
  filter: (query: string, max?: number) => Antrag[];
  byAktenzeichen: (aktenzeichen: string) => Antrag | undefined;
}

export function useAntraegeIndex(): AntraegeIndexState {
  const storage = useStorage();
  const [antraege, setAntraege] = useState<Antrag[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (programmId: string): Promise<void> => {
    setLoading(true);
    try {
      const list = await listAntraegeByProgramm(storage.idb, programmId);
      setAntraege(list);
    } finally {
      setLoading(false);
    }
  }, [storage.idb]);

  const indexByAktenzeichen = useMemo(() => {
    const map = new Map<string, Antrag>();
    for (const a of antraege) map.set(a.aktenzeichen, a);
    return map;
  }, [antraege]);

  const filter = useCallback((query: string, max = 8): Antrag[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Antrag[] = [];
    for (const a of antraege) {
      const az = a.aktenzeichen.toLowerCase();
      const ak = a.akronym?.toLowerCase() ?? '';
      const t = a.titel?.toLowerCase() ?? '';
      if (az.includes(q) || ak.includes(q) || t.includes(q)) {
        out.push(a);
        if (out.length >= max) break;
      }
    }
    return out;
  }, [antraege]);

  const byAktenzeichen = useCallback(
    (aktenzeichen: string): Antrag | undefined => indexByAktenzeichen.get(aktenzeichen),
    [indexByAktenzeichen],
  );

  return { antraege, loading, load, filter, byAktenzeichen };
}
