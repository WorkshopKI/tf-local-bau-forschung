/**
 * Kurator-Session-Zustand-Store (Phase 1a, Modul C).
 *
 * Nach `aktiviere()`: 12h TTL (override in Dev-Panel möglich). Activity-Tracking
 * ruft extend() → Timer verlängert sich. Der Timer selbst (setInterval jede
 * Minute) wird in ShellLayout montiert, nicht im Store — Stores bleiben
 * reaktiv & react-agnostisch.
 *
 * **v3.0: Die Session verifiziert kein Passwort mehr.** Bis v2.x gab es dafuer
 * ZWEI Wege — `_intern/kurator-config.enc` auf dem Share (setup/activate/
 * changePassword) und das im Build eingebackene Passwort der Wall
 * (`activateSynthetic`). Zwei Wege zum selben Ziel driften auseinander; geblieben
 * ist der Build-Weg, weil er schon VOR der Ordner-Freigabe funktioniert und
 * dieselbe Krypto nutzt wie das App-Passwort. Die Verifikation liegt jetzt
 * ausschliesslich beim Aufrufer (`verifyModulPassword`), dieser Store haelt nur
 * noch den Zustand. Preis: ein Passwortwechsel erfordert einen Rebuild —
 * konsistent mit Pitfall #28, wo das fuers App-Passwort ohnehin gilt.
 */

import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import { DEFAULT_SESSION_TTL_MS, KURATOR_SESSION_META_IDB_KEY } from '@/core/services/infrastructure/types';
import type { SessionMeta } from '@/core/services/infrastructure/types';

export interface KuratorSessionState {
  isActive: boolean;
  kuratorName: string | null;
  expiresAt: number | null;
  ttlMs: number;

  /**
   * Oeffnet die Session. Das Passwort ist zu diesem Zeitpunkt bereits geprueft
   * (AppPasswordGate / Freischalt-Sektion) — hier wird nur noch der Zustand
   * gesetzt, die IDB-Meta geschrieben und ein Audit-Eintrag gelegt.
   */
  aktiviere: (idb: IDBStore, name: string) => Promise<void>;
  deactivate: (idb: IDBStore) => Promise<void>;
  extend: () => void;
  setTtl: (ms: number) => void;
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

  aktiviere: async (idb, name) => {
    const expiresAt = Date.now() + get().ttlMs;
    set({ isActive: true, kuratorName: name, expiresAt });
    await writeMeta(idb, { kuratorName: name, expiresAt });
    await logAudit(idb, { action: 'kurator_login_buildtime', user: name });
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
