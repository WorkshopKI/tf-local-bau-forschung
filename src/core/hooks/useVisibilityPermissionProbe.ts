/**
 * Tab-Wakeup-Permission-Probe.
 *
 * Bei `visibilitychange === 'visible'` ruft der Hook `queryPermission` auf den
 * Daten-Share- und Persoenlich-Handle auf und updated `useConnectionState`.
 *
 * Wichtig: queryPermission ist non-invasiv (kein User-Gesture noetig). Wenn
 * der Browser die Permission entzogen hat (z.B. nach Browser-Restart),
 * liefert es 'prompt' — useConnectionState.mode flippt auf 'offline' und der
 * OfflineBanner zeigt sich. requestPermission braucht User-Gesture und wird
 * hier bewusst NICHT aufgerufen.
 */

import { useEffect } from 'react';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  getDatenShareHandle,
  getPersoenlichHandle,
  type FsDirHandle,
} from '@/core/services/infrastructure/smb-handle';
import { useConnectionState } from '@/core/services/connection-status';
import { canWriteDatenShare } from '@/config/feature-flags';

type PermStateOrMissing = 'granted' | 'denied' | 'prompt' | 'missing';

async function queryHandlePermission(
  handle: FileSystemDirectoryHandle | null,
  mode: 'read' | 'readwrite',
): Promise<PermStateOrMissing> {
  if (!handle) return 'missing';
  try {
    const state = await (handle as FsDirHandle).queryPermission({ mode });
    return state as PermStateOrMissing;
  } catch {
    return 'denied';
  }
}

export function useVisibilityPermissionProbe(
  idb: IDBStore | null,
  isKurator: boolean,
): void {
  const applyRefreshResult = useConnectionState(s => s.applyRefreshResult);

  useEffect(() => {
    if (!idb) return;
    const onVisible = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') return;
      const [datenShare, persoenlich] = await Promise.all([
        getDatenShareHandle(idb).catch(() => null),
        getPersoenlichHandle(idb).catch(() => null),
      ]);
      const [dsState, psState] = await Promise.all([
        queryHandlePermission(datenShare, canWriteDatenShare(isKurator) ? 'readwrite' : 'read'),
        queryHandlePermission(persoenlich, 'readwrite'),
      ]);
      applyRefreshResult({
        datenShare: dsState,
        persoenlich: psState,
        userFoldersRoots: {},
        dmsSources: {},
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [idb, isKurator, applyRefreshResult]);
}
