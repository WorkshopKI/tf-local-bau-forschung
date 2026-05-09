import { create } from 'zustand';
import type { Vorgang } from '@/core/types/vorgang';
import type { StorageService } from '@/core/services/storage';
import { generatePrefixedId } from '@/core/services/id-generator';
import { tfPerfStart } from '@/core/utils/tfPerf';

interface BauantraegeState {
  bauantraege: Vorgang[];
  selectedId: string | null;
  loading: boolean;
  filters: { status: string; search: string };
  /** Wann der Store zuletzt erfolgreich geladen hat. Fuer TTL-Skip-Path
   *  in `loadAll` — schnelle Re-Mounts der Home-Seite ueberspringen den
   *  IDB-Read; nach laengeren Pausen wird neu geladen. */
  lastLoadedAt: number;
  loadAll: (storage: StorageService, opts?: { force?: boolean }) => Promise<void>;
  add: (vorgang: Partial<Vorgang>, storage: StorageService) => Promise<void>;
  update: (vorgang: Vorgang, storage: StorageService) => Promise<void>;
  remove: (id: string, storage: StorageService) => Promise<void>;
  setSelectedId: (id: string | null) => void;
  setFilters: (filters: Partial<{ status: string; search: string }>) => void;
}

/** Schnell-Navigations-TTL: innerhalb dieses Fensters wird ein erneuter
 *  loadAll-Aufruf uebersprungen. Bauantraege liegen auf dem FS-Share und
 *  aendern sich seltener als CSV-importierte Antraege; 30 s sind sicher. */
const LOAD_ALL_SKIP_TTL_MS = 30_000;

export const useBauantraegeStore = create<BauantraegeState>((set, get) => ({
  bauantraege: [],
  selectedId: null,
  loading: false,
  filters: { status: '', search: '' },
  lastLoadedAt: 0,

  loadAll: async (storage, opts) => {
    const end = tfPerfStart('bauantraege.loadAll');
    const state = get();
    if (
      !opts?.force
      && state.bauantraege.length > 0
      && Date.now() - state.lastLoadedAt < LOAD_ALL_SKIP_TTL_MS
    ) {
      end('skipped (TTL)');
      return;
    }
    set({ loading: true });
    const list = await storage.listVorgaenge('bauantrag');
    set({ bauantraege: list, loading: false, lastLoadedAt: Date.now() });
    end(`n=${list.length}`);
  },

  add: async (partial, storage) => {
    const { bauantraege } = get();
    const now = new Date().toISOString();
    const vorgang: Vorgang = {
      id: generatePrefixedId('BA', bauantraege),
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
