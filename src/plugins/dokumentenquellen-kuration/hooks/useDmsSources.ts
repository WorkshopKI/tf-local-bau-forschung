/**
 * Hook fuer die DMS-Source-Liste + Handle-Status-Probe.
 *
 * Laedt einmal beim Mount, refetcht nach jeder Mutation. Probet auch den
 * Read-Permission-Status aller Handles, damit das UI Connected/Lost/Missing
 * anzeigen kann.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  listDmsSources,
  type DmsSourceEntry,
  type DmsSourceHandleStatus,
} from '@/core/services/dms-sources';
import {
  getDmsSourceHandle,
  queryReadPermission,
} from '@/core/services/infrastructure/smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';

export interface DmsSourcesState {
  sources: DmsSourceEntry[];
  /** Map sourceId -> handle status (live, nicht persistiert). */
  handleStatus: Record<string, DmsSourceHandleStatus>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

async function probeHandleStatus(
  idb: IDBStore,
  sources: DmsSourceEntry[],
): Promise<Record<string, DmsSourceHandleStatus>> {
  const out: Record<string, DmsSourceHandleStatus> = {};
  for (const s of sources) {
    const h = await getDmsSourceHandle(idb, s.id);
    if (!h) {
      out[s.id] = 'missing';
      continue;
    }
    try {
      const perm = await queryReadPermission(h);
      out[s.id] = perm === 'granted' ? 'connected' : 'permission_lost';
    } catch {
      out[s.id] = 'permission_lost';
    }
  }
  return out;
}

export function useDmsSources(idb: IDBStore): DmsSourcesState {
  const [sources, setSources] = useState<DmsSourceEntry[]>([]);
  const [handleStatus, setHandleStatus] = useState<Record<string, DmsSourceHandleStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const all = await listDmsSources(idb);
      setSources(all);
      const status = await probeHandleStatus(idb, all);
      setHandleStatus(status);
    } catch (e) {
      setError(`Liste konnte nicht geladen werden: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [idb]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sources, handleStatus, loading, error, reload };
}
