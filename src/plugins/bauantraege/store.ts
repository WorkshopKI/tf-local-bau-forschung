import { create } from 'zustand';
import type { Vorgang } from '@/core/types/vorgang';
import type { StorageService } from '@/core/services/storage';

interface BauantraegeState {
  bauantraege: Vorgang[];
  selectedId: string | null;
  loading: boolean;
  filters: { status: string; search: string };
  loadAll: (storage: StorageService) => Promise<void>;
  add: (vorgang: Partial<Vorgang>, storage: StorageService) => Promise<void>;
  update: (vorgang: Vorgang, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  setSelectedId: (id: string | null) => void;
  setFilters: (filters: Partial<{ status: string; search: string }>) => void;
}

function generateId(existing: Vorgang[]): string {
  const year = new Date().getFullYear();
  const prefix = `BA-${year}-`;
  const nums = existing
    .filter(v => v.id.startsWith(prefix))
    .map(v => parseInt(v.id.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export const useBauantraegeStore = create<BauantraegeState>((set, get) => ({
  bauantraege: [],
  selectedId: null,
  loading: false,
  filters: { status: '', search: '' },

  loadAll: async (storage) => {
    set({ loading: true });
    const list = await storage.listVorgaenge('bauantrag');
    set({ bauantraege: list, loading: false });
  },

  add: async (partial, storage) => {
    const { bauantraege } = get();
    const now = new Date().toISOString();
    const vorgang: Vorgang = {
      id: generateId(bauantraege),
      type: 'bauantrag',
      title: partial.title ?? '',
      status: partial.status ?? 'neu',
      priority: partial.priority ?? 'normal',
      assignee: partial.assignee ?? '',
      created: now,
      modified: now,
      deadline: partial.deadline,
      tags: partial.tags ?? [],
      notes: partial.notes ?? '',
    };
    await storage.saveVorgang(vorgang);
    set({ bauantraege: [...bauantraege, vorgang] });
  },

  update: async (vorgang, storage) => {
    await storage.saveVorgang(vorgang);
    set({
      bauantraege: get().bauantraege.map(v => v.id === vorgang.id ? vorgang : v),
    });
  },

  remove: async (id, storage) => {
    await storage.deleteVorgang(id);
    set({
      bauantraege: get().bauantraege.filter(v => v.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

  setSelectedId: (id) => set({ selectedId: id }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
}));
