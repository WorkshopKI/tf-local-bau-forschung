/**
 * De-Anonymisierungs-Session (v2.5).
 *
 * Schaltet die Klartext-Anzeige der TIB-Kuerzel im Auslastungs-Modul frei.
 * Aktiviert sich erst nach erfolgreicher Passwort-Verifikation gegen
 * `_intern/deanon-config.enc` (PL-Single-Password fuer das gesamte Team).
 *
 * 24h TTL, Activity-verlaengert via `useDeAnonActivityTracker` — solange
 * der User klickt oder tippt, wird die Session jeden Tag fortgesetzt;
 * 24h Untaetigkeit beendet sie automatisch.
 *
 * Sichtbarkeit/Gating uebernimmt der Aufrufer (Feature-Flag
 * `isDeAnonEnabled()`). Wenn der Flag aus ist, sollte der Hook gar nicht
 * erst gerendert werden.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  isDeAnonConfigured,
  setupDeAnonConfig,
  verifyDeAnonPassword,
  changeDeAnonPassword,
} from '@/core/services/infrastructure/deanon-config';
import {
  DEANON_SESSION_META_IDB_KEY,
  DEFAULT_DEANON_TTL_MS,
} from '@/core/services/infrastructure/types';
import type { DeAnonSessionMeta } from '@/core/services/infrastructure/types';

export interface DeAnonSessionState {
  isActive: boolean;
  expiresAt: number | null;
  ttlMs: number;

  setup: (idb: IDBStore, password: string) => Promise<boolean>;
  activate: (idb: IDBStore, password: string) => Promise<boolean>;
  deactivate: (idb: IDBStore) => Promise<void>;
  extend: (idb?: IDBStore) => void;
  changePassword: (idb: IDBStore, oldPw: string, newPw: string) => Promise<boolean>;
  isConfigured: (idb: IDBStore) => Promise<boolean>;
  rehydrate: (idb: IDBStore) => Promise<void>;
  tick: (idb: IDBStore) => void;
}

async function writeMeta(idb: IDBStore, meta: DeAnonSessionMeta | null): Promise<void> {
  if (meta) await idb.set(DEANON_SESSION_META_IDB_KEY, meta);
  else await idb.delete(DEANON_SESSION_META_IDB_KEY);
}

export const useDeAnonSession = create<DeAnonSessionState>((set, get) => ({
  isActive: false,
  expiresAt: null,
  ttlMs: DEFAULT_DEANON_TTL_MS,

  setup: async (idb, password) => {
    try {
      await setupDeAnonConfig(idb, password);
      return true;
    } catch (err) {
      console.error('DeAnonSession.setup failed:', err);
      return false;
    }
  },

  activate: async (idb, password) => {
    const plain = await verifyDeAnonPassword(idb, password);
    if (!plain) return false;
    const expiresAt = Date.now() + get().ttlMs;
    set({ isActive: true, expiresAt });
    await writeMeta(idb, { expiresAt });
    return true;
  },

  deactivate: async (idb) => {
    set({ isActive: false, expiresAt: null });
    await writeMeta(idb, null);
  },

  // extend wird vom Activity-Tracker periodisch aufgerufen. IDB-Write ist
  // optional (nur wenn idb mitgegeben wird) — fuer den haeufigen Tick reicht
  // der In-Memory-State, fuer Cross-Tab-Konsistenz spaeter ist die Persistenz
  // hilfreich, kostet aber pro Aktivitaet ein IDB-write.
  extend: (idb) => {
    const { isActive, ttlMs } = get();
    if (!isActive) return;
    const expiresAt = Date.now() + ttlMs;
    set({ expiresAt });
    if (idb) void writeMeta(idb, { expiresAt });
  },

  changePassword: async (idb, oldPw, newPw) => {
    return changeDeAnonPassword(idb, oldPw, newPw);
  },

  isConfigured: async (idb) => isDeAnonConfigured(idb),

  rehydrate: async (idb) => {
    const meta = await idb.get<DeAnonSessionMeta>(DEANON_SESSION_META_IDB_KEY);
    if (!meta) return;
    if (meta.expiresAt > Date.now()) {
      set({ isActive: true, expiresAt: meta.expiresAt });
    } else {
      await idb.delete(DEANON_SESSION_META_IDB_KEY);
    }
  },

  tick: (idb) => {
    const { isActive, expiresAt } = get();
    if (isActive && expiresAt !== null && Date.now() > expiresAt) {
      void get().deactivate(idb);
    }
  },
}));

/**
 * Activity-Tracker: bei Klick/Tastatur-Aktivitaet wird die DeAnon-Session
 * verlaengert (TTL = 24h ab letzter Aktivitaet). Throttle 60s, damit nicht
 * pro Tastenanschlag ein IDB-Write erfolgt.
 */
const ACTIVITY_THROTTLE_MS = 60_000;

export function useDeAnonActivityTracker(idb: IDBStore): void {
  useEffect(() => {
    let last = 0;
    const handler = (): void => {
      const now = Date.now();
      if (now - last < ACTIVITY_THROTTLE_MS) return;
      last = now;
      const state = useDeAnonSession.getState();
      if (state.isActive) state.extend(idb);
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, [idb]);
}
