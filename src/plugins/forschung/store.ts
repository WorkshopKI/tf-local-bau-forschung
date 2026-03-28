import { create } from 'zustand';
import type { StorageService } from '@/core/services/storage';
import type { ForschungsVorgang } from './types';

interface ForschungState {
  antraege: ForschungsVorgang[];
  selectedId: string | null;
  loading: boolean;
  filters: { status: string; search: string };
  loadAll: (storage: StorageService) => Promise<void>;
  add: (partial: Partial<ForschungsVorgang>, storage: StorageService) => Promise<void>;
  update: (vorgang: ForschungsVorgang, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  setSelectedId: (id: string | null) => void;
  setFilters: (f: Partial<{ status: string; search: string }>) => void;
}

function generateId(existing: ForschungsVorgang[]): string {
  const year = new Date().getFullYear();
  const prefix = `FA-${year}-`;
  const nums = existing.filter(v => v.id.startsWith(prefix))
    .map(v => parseInt(v.id.slice(prefix.length), 10)).filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export const useForschungStore = create<ForschungState>((set, get) => ({
  antraege: [],
  selectedId: null,
  loading: false,
  filters: { status: '', search: '' },

  loadAll: async (storage) => {
    set({ loading: true });
    const list = await storage.listVorgaenge('forschung');
    set({ antraege: list as ForschungsVorgang[], loading: false });
  },

  add: async (partial, storage) => {
    const { antraege } = get();
    const now = new Date().toISOString();
    const vorgang: ForschungsVorgang = {
      id: generateId(antraege), type: 'forschung',
      title: partial.title ?? '', status: partial.status ?? 'eingereicht' as ForschungsVorgang['status'],
      priority: partial.priority ?? 'normal', assignee: partial.assignee ?? '',
      created: now, modified: now, deadline: partial.deadline, tags: partial.tags ?? [], notes: partial.notes ?? '',
      foerderprogramm: partial.foerderprogramm ?? '', foerdersumme: partial.foerdersumme ?? 0,
      laufzeit: partial.laufzeit ?? '', projektleiter: partial.projektleiter ?? '',
      institution: partial.institution ?? '', forschungsgebiet: partial.forschungsgebiet ?? '',
    };
    await storage.saveVorgang(vorgang);
    set({ antraege: [...antraege, vorgang] });
  },

  update: async (vorgang, storage) => {
    await storage.saveVorgang(vorgang);
    set({ antraege: get().antraege.map(v => v.id === vorgang.id ? vorgang : v) });
  },

  remove: async (id, storage) => {
    await storage.deleteVorgang(id);
    set({ antraege: get().antraege.filter(v => v.id !== id), selectedId: get().selectedId === id ? null : get().selectedId });
  },

  setSelectedId: (id) => set({ selectedId: id }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
}));
