/**
 * Connection-Mode-Ableitung (v2.0).
 *
 * Zentrale Logik fuer "Online / Offline"-Banner und gate'd Aktionen.
 * Setzt auf den bestehenden useSmbStatus-Store auf und ergaenzt um den
 * Persoenlich-Handle (separater Erreichbarkeits-Status).
 *
 * `ConnectionMode = 'online' | 'offline'`. Citrix-Modus wurde bewusst nicht
 * eingefuehrt — funktional identisch zu Online.
 */

import { create } from 'zustand';
import type { RefreshAllResult } from '@/core/services/infrastructure/smb-handle';

export type ConnectionMode = 'online' | 'offline';

export interface ConnectionState {
  mode: ConnectionMode;
  datenShareAvailable: boolean;
  persoenlichAvailable: boolean;
  /** Letzter Snapshot-Sync-Zeitpunkt (programm-spezifisch). UI-Display "Daten vom ...". */
  lastSyncTimestamp: string | null;
}

const INITIAL: ConnectionState = {
  mode: 'offline',
  datenShareAvailable: false,
  persoenlichAvailable: false,
  lastSyncTimestamp: null,
};

interface ConnectionStore extends ConnectionState {
  applyRefreshResult: (result: RefreshAllResult, opts?: { lastSyncTimestamp?: string | null }) => void;
  setLastSyncTimestamp: (ts: string | null) => void;
  setPersoenlichAvailable: (available: boolean) => void;
  reset: () => void;
}

export const useConnectionState = create<ConnectionStore>((set) => ({
  ...INITIAL,

  applyRefreshResult: (result, opts) => {
    const datenShareAvailable = result.datenShare === 'granted';
    const persoenlichAvailable = result.persoenlich === 'granted';
    const mode: ConnectionMode = datenShareAvailable ? 'online' : 'offline';
    set({
      mode,
      datenShareAvailable,
      persoenlichAvailable,
      ...(opts?.lastSyncTimestamp !== undefined ? { lastSyncTimestamp: opts.lastSyncTimestamp } : {}),
    });
  },

  setLastSyncTimestamp: (ts) => set({ lastSyncTimestamp: ts }),

  setPersoenlichAvailable: (available) => set({ persoenlichAvailable: available }),

  reset: () => set({ ...INITIAL }),
}));

/** Pure-Function-Variante fuer Aufrufer die ohne Store leben. */
export function deriveConnectionMode(result: RefreshAllResult): ConnectionMode {
  return result.datenShare === 'granted' ? 'online' : 'offline';
}
