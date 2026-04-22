/**
 * Kurator-Session-Zustand-Store (Phase 1a, Modul C).
 *
 * Nach activate(): 12h TTL (override in Dev-Panel möglich). Activity-Tracking
 * ruft extend() → Timer verlängert sich. Der Timer selbst (setInterval jede
 * Minute) wird in Shell.tsx montiert, nicht im Store — Stores bleiben
 * reaktiv & react-agnostisch.
 */

import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  isKuratorConfigured,
  setupKuratorConfig,
  verifyPassword,
  changeKuratorPassword,
  readKuratorName,
} from '@/core/services/infrastructure/kurator-config';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { DEFAULT_SESSION_TTL_MS, KURATOR_SESSION_META_IDB_KEY } from '@/core/services/infrastructure/types';
import type { SessionMeta } from '@/core/services/infrastructure/types';

export interface KuratorSessionState {
  isActive: boolean;
  kuratorName: string | null;
  expiresAt: number | null;
  ttlMs: number;

  setup: (idb: IDBStore, name: string, password: string) => Promise<boolean>;
  activate: (idb: IDBStore, password: string) => Promise<boolean>;
  deactivate: (idb: IDBStore) => Promise<void>;
  extend: () => void;
  setTtl: (ms: number) => void;
  changePassword: (idb: IDBStore, oldPw: string, newPw: string) => Promise<boolean>;
  isConfigured: (idb: IDBStore) => Promise<boolean>;
  rehydrate: (idb: IDBStore) => Promise<void>;
  tick: (idb: IDBStore) => void;
}

async function writeMeta(idb: IDBStore, meta: SessionMeta | null): Promise<void> {
  if (meta) await idb.set(KURATOR_SESSION_META_IDB_KEY, meta);
  else await idb.delete(KURATOR_SESSION_META_IDB_KEY);
}

export const useKuratorSession = create<KuratorSessionState>((set, get) => ({
  isActive: false,
  kuratorName: null,
  expiresAt: null,
  ttlMs: DEFAULT_SESSION_TTL_MS,

  setup: async (idb, name, password) => {
    try {
      await setupKuratorConfig(idb, name, password);
      await logAudit(idb, { action: 'kurator_setup', user: name });
      return true;
    } catch (err) {
      console.error('KuratorSession.setup failed:', err);
      return false;
    }
  },

  activate: async (idb, password) => {
    const plain = await verifyPassword(idb, password);
    if (!plain) return false;
    const kuratorName = plain.kuratorName;
    const expiresAt = Date.now() + get().ttlMs;
    set({ isActive: true, kuratorName, expiresAt });
    await writeMeta(idb, { kuratorName, expiresAt });
    await logAudit(idb, { action: 'kurator_login', user: kuratorName });
    return true;
  },

  deactivate: async (idb) => {
    const name = get().kuratorName;
    set({ isActive: false, kuratorName: null, expiresAt: null });
    await writeMeta(idb, null);
    if (name) await logAudit(idb, { action: 'kurator_logout', user: name });
  },

  extend: () => {
    const { isActive, ttlMs } = get();
    if (!isActive) return;
    set({ expiresAt: Date.now() + ttlMs });
  },

  setTtl: (ms) => {
    const { isActive } = get();
    set({ ttlMs: ms, expiresAt: isActive ? Date.now() + ms : null });
  },

  changePassword: async (idb, oldPw, newPw) => {
    const ok = await changeKuratorPassword(idb, oldPw, newPw);
    if (ok) {
      const name = get().kuratorName ?? (await readKuratorName(idb));
      await logAudit(idb, { action: 'kurator_password_changed', user: name ?? 'unknown' });
    }
    return ok;
  },

  isConfigured: async (idb) => isKuratorConfigured(idb),

  rehydrate: async (idb) => {
    const meta = await idb.get<SessionMeta & { adminName?: string }>(KURATOR_SESSION_META_IDB_KEY);
    if (!meta) return;
    // Kompat: alte Einträge haben `adminName` statt `kuratorName`.
    const kuratorName = meta.kuratorName ?? meta.adminName ?? '';
    if (meta.expiresAt > Date.now()) {
      set({ isActive: true, kuratorName, expiresAt: meta.expiresAt });
    } else {
      await idb.delete(KURATOR_SESSION_META_IDB_KEY);
    }
  },

  tick: (idb) => {
    const { isActive, expiresAt } = get();
    if (isActive && expiresAt !== null && Date.now() > expiresAt) {
      void get().deactivate(idb);
    }
  },
}));
