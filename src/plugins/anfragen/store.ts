/**
 * UI-State + Persistenz-Orchestrierung für das Anfragen-Modul (Zustand).
 * Jede Mutation = ein `put`/`delete` + ein finales `set` (Save-Lock-Disziplin,
 * CLAUDE.md Pitfall #16/#20).
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import type { Anfrage } from './types';
import { deleteAnfrage, listAnfragen, putAnfrage } from './persistence';

const byNewest = (p: Anfrage, q: Anfrage): number =>
  (q.erstelltAm ?? '').localeCompare(p.erstelltAm ?? '');

interface AnfragenState {
  anfragen: Anfrage[];
  selectedId: string | null;
  loading: boolean;

  loadAll: (storage: StorageService) => Promise<void>;
  /** Persistiert und stempelt `geaendertAm`; legt neue an oder ersetzt bestehende. */
  upsert: (a: Anfrage, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  select: (id: string | null) => void;
}

export const useAnfragenStore = create<AnfragenState>((set, get) => ({
  anfragen: [],
  selectedId: null,
  loading: false,

  loadAll: async (storage) => {
    set({ loading: true });
    const anfragen = await listAnfragen(storage.idb);
    set({ anfragen, loading: false });
  },

  upsert: async (a, storage) => {
    const stamped: Anfrage = { ...a, geaendertAm: new Date().toISOString() };
    await putAnfrage(storage.idb, stamped);
    const rest = get().anfragen.filter(x => x.id !== stamped.id);
    set({ anfragen: [stamped, ...rest].sort(byNewest) });
  },

  remove: async (id, storage) => {
    await deleteAnfrage(storage.idb, id);
    set({
      anfragen: get().anfragen.filter(x => x.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

  select: (id) => set({ selectedId: id }),
}));
