/**
 * Laedt Manifest-, Skip-List- und Pending-Bucket-Eintraege parallel und cached
 * sie im React-State. Mutations (reloadEntry/removeEntry/rematchPending)
 * gehen einzeln gegen IDB und mergen das Ergebnis in den Cache, damit Filter +
 * Sort lokal in useMemos laufen koennen — kein erneuter IDB-Roundtrip pro
 * Filter-Wechsel.
 */
import { useCallback, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  listManifestEntries,
  listAllSkipEntries,
  listAllPending,
  getManifestEntry,
  rematchOnSnapshotReload,
  type ManifestEntry,
  type SkipListEntry,
  type PendingAntragEntry,
} from '@/phase2';

interface ManifestDataState {
  entries: ManifestEntry[];
  skipEntries: SkipListEntry[];
  pending: PendingAntragEntry[];
  loading: boolean;
  load: () => Promise<void>;
  reloadEntry: (filename: string) => Promise<void>;
  removeEntry: (filename: string) => void;
  rematchPending: (programmId: string) => Promise<{ resolved: number; remaining: number }>;
}

export function useManifestData(): ManifestDataState {
  const storage = useStorage();
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [skipEntries, setSkipEntries] = useState<SkipListEntry[]>([]);
  const [pending, setPending] = useState<PendingAntragEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [m, s, p] = await Promise.all([
        listManifestEntries(storage.idb),
        listAllSkipEntries(storage.idb),
        listAllPending(storage.idb),
      ]);
      setEntries(m);
      setSkipEntries(s);
      setPending(p);
    } finally {
      setLoading(false);
    }
  }, [storage.idb]);

  const reloadEntry = useCallback(async (filename: string): Promise<void> => {
    const fresh = await getManifestEntry(storage.idb, filename);
    setEntries(prev => {
      if (!fresh) return prev.filter(e => e.filename !== filename);
      const idx = prev.findIndex(e => e.filename === filename);
      if (idx === -1) return [fresh, ...prev];
      const next = prev.slice();
      next[idx] = fresh;
      return next;
    });
  }, [storage.idb]);

  const removeEntry = useCallback((filename: string): void => {
    setEntries(prev => prev.filter(e => e.filename !== filename));
    setSkipEntries(prev => prev.filter(s => s.filename !== filename));
  }, []);

  const rematchPending = useCallback(async (programmId: string) => {
    const result = await rematchOnSnapshotReload(storage.idb, programmId);
    // Pending- und Manifest-Liste neu laden (rematchOnSnapshotReload kann
    // Pending-Eintraege loeschen und Manifest-Eintraege updaten).
    const [m, p] = await Promise.all([
      listManifestEntries(storage.idb),
      listAllPending(storage.idb),
    ]);
    setEntries(m);
    setPending(p);
    return result;
  }, [storage.idb]);

  return { entries, skipEntries, pending, loading, load, reloadEntry, removeEntry, rematchPending };
}
