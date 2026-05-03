/**
 * Active-Programm-State.
 *
 * Hält das gerade aktive Förderprogramm in einem Zustand-Store. Persistenz
 * über `UserProfile.activeProgrammId` (per-User in IDB).
 *
 * Init-Logik:
 *   1. listProgramme(idb) laden.
 *   2. Active = profile.activeProgrammId falls valide,
 *      sonst programme[0],
 *      sonst null (Caller kümmert sich darum, ein Default-Programm zu erzeugen).
 *
 * Subscriber (Antraege-Store, Home-Dashboard, Kurations-Plugins) lauschen via
 * useActiveProgramm() — bei einem Switch wird ihr Effect re-fired, sodass
 * sie ihre Daten neu laden.
 */

import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Programm } from '@/core/services/csv/types';
import type { UserProfile } from '@/core/types/config';
import { listProgramme } from '@/core/services/csv/idb-csv';

interface ActiveProgrammState {
  /** Aktive Programm-ID oder null wenn noch nichts geladen / kein Programm existiert. */
  activeProgrammId: string | null;
  /** Alle bekannten Programme aus dem programme-Store. */
  programme: Programm[];
  /** True während init() oder refresh() läuft. */
  loading: boolean;
  /**
   * Lädt programme-Liste und setzt aktives Programm aus dem Profile (Fallback:
   * erstes Programm). Idempotent — kann beliebig oft aufgerufen werden.
   */
  init: (idb: IDBStore, profile: UserProfile | null) => Promise<void>;
  /** Programme-Liste neu laden, behält activeProgrammId wenn noch valide. */
  refresh: (idb: IDBStore) => Promise<void>;
  /**
   * Aktives Programm wechseln. Schreibt zurück ins Profile (über `updateProfile`-
   * Callback, weil wir hier keinen direkten Zugriff auf den ProfileContext haben).
   * Caller ist typischerweise ProgrammSwitcher: `setActive(idb, id, updateProfile)`.
   */
  setActive: (
    idb: IDBStore,
    id: string,
    updateProfile?: (updates: Partial<UserProfile>) => Promise<void>,
  ) => Promise<void>;
}

export const useActiveProgramm = create<ActiveProgrammState>((set, get) => ({
  activeProgrammId: null,
  programme: [],
  loading: false,

  init: async (idb, profile) => {
    set({ loading: true });
    try {
      const programme = await listProgramme(idb);
      let activeId: string | null = null;
      const fromProfile = profile?.activeProgrammId;
      if (fromProfile && programme.some(p => p.id === fromProfile)) {
        activeId = fromProfile;
      } else if (programme[0]) {
        activeId = programme[0].id;
      }
      set({ programme, activeProgrammId: activeId, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  refresh: async (idb) => {
    set({ loading: true });
    try {
      const programme = await listProgramme(idb);
      const current = get().activeProgrammId;
      const stillValid = current && programme.some(p => p.id === current);
      const next = stillValid ? current : (programme[0]?.id ?? null);
      set({ programme, activeProgrammId: next, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActive: async (idb, id, updateProfile) => {
    const programme = get().programme;
    if (!programme.some(p => p.id === id)) {
      // Programm-Liste neu laden — der Switcher könnte ein frisch erstelltes
      // Programm gewählt haben, das noch nicht im Cache ist.
      await get().refresh(idb);
      const after = get().programme;
      if (!after.some(p => p.id === id)) return;
    }
    set({ activeProgrammId: id });
    if (updateProfile) {
      await updateProfile({ activeProgrammId: id });
    }
  },
}));
