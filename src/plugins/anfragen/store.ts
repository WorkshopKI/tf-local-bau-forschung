/**
 * UI-State + Persistenz-Orchestrierung für das Anfragen-Modul (Zustand).
 * Jede Mutation = ein `put`/`delete` + ein finales `set` (Save-Lock-Disziplin,
 * CLAUDE.md Pitfall #16/#20).
 */
import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import type { ViewMode } from '@/components/ui/ViewModeToggle';
import type { Anfrage } from './types';
import { deleteAnfrage, listAnfragen, putAnfrage } from './persistence';

const byNewest = (p: Anfrage, q: Anfrage): number =>
  (q.erstelltAm ?? '').localeCompare(p.erstelltAm ?? '');

/** localStorage-Key für den gewählten Ansichts-Modus (reine UI-Präferenz). */
const VIEW_MODE_KEY = 'teamflow_anfragen_view_mode';

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'list' || v === 'table' || v === 'cards') return v;
  } catch { /* ignore */ }
  return 'list';
}

interface AnfragenState {
  anfragen: Anfrage[];
  selectedId: string | null;
  loading: boolean;
  viewMode: ViewMode;

  loadAll: (storage: StorageService) => Promise<void>;
  /** Persistiert und stempelt `geaendertAm`; legt neue an oder ersetzt bestehende. */
  upsert: (a: Anfrage, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  select: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useAnfragenStore = create<AnfragenState>((set, get) => ({
  anfragen: [],
  selectedId: null,
  loading: false,
  viewMode: loadViewMode(),

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

  setViewMode: (mode) => {
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* ignore */ }
    set({ viewMode: mode });
  },
}));
