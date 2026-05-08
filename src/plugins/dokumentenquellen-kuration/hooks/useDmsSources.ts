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
  /**
   * Map sourceId -> Ordnername des verbundenen Handles. Browser-Security
   * erlaubt nur den letzten Pfad-Bestandteil — kein vollstaendiger Pfad.
   * `null` wenn kein Handle verbunden.
   */
  handleNames: Record<string, string | null>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

async function probeHandles(
  idb: IDBStore,
  sources: DmsSourceEntry[],
): Promise<{ status: Record<string, DmsSourceHandleStatus>; names: Record<string, string | null> }> {
  const status: Record<string, DmsSourceHandleStatus> = {};
  const names: Record<string, string | null> = {};
  for (const s of sources) {
    const h = await getDmsSourceHandle(idb, s.id);
    if (!h) {
      status[s.id] = 'missing';
      names[s.id] = null;
      continue;
    }
    names[s.id] = h.name;
    try {
      const perm = await queryReadPermission(h);
      status[s.id] = perm === 'granted' ? 'connected' : 'permission_lost';
    } catch {
      status[s.id] = 'permission_lost';
    }
  }
  return { status, names };
}

export function useDmsSources(idb: IDBStore): DmsSourcesState {
  const [sources, setSources] = useState<DmsSourceEntry[]>([]);
  const [handleStatus, setHandleStatus] = useState<Record<string, DmsSourceHandleStatus>>({});
  const [handleNames, setHandleNames] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const all = await listDmsSources(idb);
      setSources(all);
      const probed = await probeHandles(idb, all);
      setHandleStatus(probed.status);
      setHandleNames(probed.names);
    } catch (e) {
      setError(`Liste konnte nicht geladen werden: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [idb]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sources, handleStatus, handleNames, loading, error, reload };
}
