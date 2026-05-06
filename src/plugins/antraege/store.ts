import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  ensureDefaultProgramm,
  listAntraegeByProgramm,
} from '@/core/services/csv';
import { listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import type { ViewKey } from './views';

const ACTIVE_VIEW_KEY = 'teamflow_antraege_active_view';

function loadActiveView(): ViewKey {
  try {
    const v = localStorage.getItem(ACTIVE_VIEW_KEY);
    if (v === 'meine_offenen' || v === 'diese_woche_faellig' || v === 'ueberfaellig'
      || v === 'nachforderungen' || v === 'bewilligt_jahr' || v === 'alle') {
      return v;
    }
  } catch { /* ignore */ }
  return 'meine_offenen';
}

interface AntraegeState {
  programmId: string | null;
  antraege: Antrag[];
  verbuende: Verbund[];
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  search: string;
  activeView: ViewKey;
  loading: boolean;
  /**
   * Lädt Antraege + Verbuende für das angegebene Programm. Wird bei
   * Programm-Switch erneut aufgerufen.
   * Wenn `programmId` weggelassen wird: fällt auf `ensureDefaultProgramm()`
   * zurück (Bootstrap-Pfad).
   */
  loadAll: (idb: IDBStore, programmId?: string) => Promise<void>;
  setSearch: (s: string) => void;
  setActiveView: (view: ViewKey) => void;
  setSelectedAktenzeichen: (az: string | null) => void;
  setSelectedVerbundId: (id: string | null) => void;
  backToList: () => void;
}

export const useAntraegeStore = create<AntraegeState>((set) => ({
  programmId: null,
  antraege: [],
  verbuende: [],
  selectedAktenzeichen: null,
  selectedVerbundId: null,
  search: '',
  activeView: loadActiveView(),
  loading: false,

  loadAll: async (idb: IDBStore, programmId?: string) => {
    set({ loading: true });
    try {
      const targetId = programmId ?? (await ensureDefaultProgramm(idb)).id;
      const [antraege, verbuende] = await Promise.all([
        listAntraegeByProgramm(idb, targetId),
        listVerbuendeByProgramm(idb, targetId),
      ]);
      set({
        programmId: targetId,
        antraege,
        verbuende,
        // Beim Programm-Wechsel Detail-Selection clearen — der vorherige
        // selectedAktenzeichen würde sonst auf einen Antrag zeigen, der im
        // neuen Programm nicht existiert.
        selectedAktenzeichen: null,
        selectedVerbundId: null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  setSearch: (s: string) => set({ search: s }),

  setActiveView: (view: ViewKey) => {
    try { localStorage.setItem(ACTIVE_VIEW_KEY, view); } catch { /* ignore */ }
    set({ activeView: view });
  },

  setSelectedAktenzeichen: (az: string | null) =>
    set({ selectedAktenzeichen: az, selectedVerbundId: null }),

  setSelectedVerbundId: (id: string | null) =>
    set({ selectedVerbundId: id, selectedAktenzeichen: null }),

  backToList: () => set({ selectedAktenzeichen: null, selectedVerbundId: null }),
}));
