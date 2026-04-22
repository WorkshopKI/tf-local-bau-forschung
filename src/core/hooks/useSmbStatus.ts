/**
 * SMB-Status-Store (Phase 1a, Modul H).
 *
 * Ruft offline-check.probeSmb alle 5 Minuten im Hintergrund auf. Dev-Panel
 * kann per simulateDisconnect(durationMs) temporär Offline-State erzwingen,
 * danach automatische Recovery.
 */

import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { probeSmb } from '@/core/services/infrastructure/offline-check';
import type { SmbStatus } from '@/core/services/infrastructure/offline-check';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface Internal {
  pollHandle: number | null;
  simulateUntil: number | null;
}

export interface SmbStatusState {
  status: SmbStatus;
  lastCheck: number | null;
  check: (idb: IDBStore) => Promise<void>;
  startPolling: (idb: IDBStore) => void;
  stopPolling: () => void;
  simulateDisconnect: (durationMs: number) => void;
  requireOnline: () => boolean;
  _internal: Internal;
}

export const useSmbStatus = create<SmbStatusState>((set, get) => ({
  status: 'unknown',
  lastCheck: null,
  _internal: { pollHandle: null, simulateUntil: null },

  check: async (idb) => {
    const { _internal } = get();
    if (_internal.simulateUntil !== null) {
      if (Date.now() < _internal.simulateUntil) {
        set({ status: 'offline', lastCheck: Date.now() });
        return;
      }
      // Simulation abgelaufen — reset.
      _internal.simulateUntil = null;
    }
    const next = await probeSmb(idb);
    set({ status: next, lastCheck: Date.now() });
  },

  startPolling: (idb) => {
    const { _internal } = get();
    if (_internal.pollHandle !== null) return;
    void get().check(idb);
    const handle = window.setInterval(() => void get().check(idb), POLL_INTERVAL_MS);
    set({ _internal: { ..._internal, pollHandle: handle } });
  },

  stopPolling: () => {
    const { _internal } = get();
    if (_internal.pollHandle !== null) {
      window.clearInterval(_internal.pollHandle);
      set({ _internal: { ..._internal, pollHandle: null } });
    }
  },

  simulateDisconnect: (durationMs) => {
    const { _internal } = get();
    const until = Date.now() + durationMs;
    set({
      status: 'offline',
      lastCheck: Date.now(),
      _internal: { ..._internal, simulateUntil: until },
    });
  },

  requireOnline: () => get().status === 'online',
}));
