/**
 * Dev-Helper: Beim ersten User-Click nach App-Start den SMB-Permission-Refresh
 * aufrufen — falls Handle existiert aber Permission auf 'prompt' steht.
 *
 * Browser blockieren `requestPermission()` ausserhalb von User-Gestures, daher
 * wird der Refresh an den allerersten Click im Dokument gekoppelt (einmalig).
 *
 * Nur aktiv wenn `features.devFixtures` + `dev.autoRefreshSmbPermission`.
 */

import { useEffect } from 'react';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  getDatenShareHandle,
  queryPermission,
  refreshPermission,
} from '@/core/services/infrastructure/smb-handle';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { getDevConfig } from './dev.config';

export function useAutoSmbRefresh(idb: IDBStore): void {
  useEffect(() => {
    if (!__TEAMFLOW_DEV_FIXTURES__) return;
    const dev = getDevConfig();
    if (!dev.autoRefreshSmbPermission) return;

    let fired = false;
    const handler = async (): Promise<void> => {
      if (fired) return;
      fired = true;
      document.removeEventListener('click', runHandler, { capture: true } as EventListenerOptions);
      try {
        const handle = await getDatenShareHandle(idb);
        if (!handle) return;
        const perm = await queryPermission(handle);
        if (perm === 'granted') return;
        await refreshPermission(handle);
        await useSmbStatus.getState().check(idb);
      } catch (err) {
        console.warn('[dev-fixtures] auto SMB permission refresh failed:', err);
      }
    };
    const runHandler = (): void => { void handler(); };
    document.addEventListener('click', runHandler, { capture: true, once: true });
    return () => {
      document.removeEventListener('click', runHandler, { capture: true } as EventListenerOptions);
    };
  }, [idb]);
}
