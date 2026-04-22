import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  ensureDefaultProgramm,
  listAntraegeByProgramm,
} from '@/core/services/csv';
import { listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';

interface AntraegeState {
  programmId: string | null;
  antraege: Antrag[];
  verbuende: Verbund[];
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  search: string;
  loading: boolean;
  loadAll: (idb: IDBStore) => Promise<void>;
  setSearch: (s: string) => void;
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
  loading: false,

  loadAll: async (idb: IDBStore) => {
    set({ loading: true });
    try {
      const p = await ensureDefaultProgramm(idb);
      const [antraege, verbuende] = await Promise.all([
        listAntraegeByProgramm(idb, p.id),
        listVerbuendeByProgramm(idb, p.id),
      ]);
      set({ programmId: p.id, antraege, verbuende, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setSearch: (s: string) => set({ search: s }),

  setSelectedAktenzeichen: (az: string | null) =>
    set({ selectedAktenzeichen: az, selectedVerbundId: null }),

  setSelectedVerbundId: (id: string | null) =>
    set({ selectedVerbundId: id, selectedAktenzeichen: null }),

  backToList: () => set({ selectedAktenzeichen: null, selectedVerbundId: null }),
}));
