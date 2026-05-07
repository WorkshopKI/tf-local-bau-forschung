import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Antrag, Verbund } from '@/core/services/csv/types';
import {
  ensureDefaultProgramm,
  listAntraegeByProgramm,
} from '@/core/services/csv';
import { listVerbuendeByProgramm } from '@/core/services/csv/idb-csv';
import type { ViewKey } from './views';
import { DEFAULT_SORT_BY_VIEW, SORT_OPTIONS, type SortKey } from './sort';

const ACTIVE_VIEW_KEY = 'teamflow_antraege_active_view';
const SORT_BY_VIEW_KEY = 'teamflow_antraege_sort_by_view';

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

const VALID_SORT_KEYS = new Set<SortKey>(SORT_OPTIONS.map(o => o.key));

function loadSortByView(): Partial<Record<ViewKey, SortKey>> {
  try {
    const raw = localStorage.getItem(SORT_BY_VIEW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<ViewKey, SortKey>> = {};
    for (const [view, key] of Object.entries(parsed)) {
      if (typeof key === 'string' && VALID_SORT_KEYS.has(key as SortKey)) {
        out[view as ViewKey] = key as SortKey;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveSortByView(map: Partial<Record<ViewKey, SortKey>>): void {
  try { localStorage.setItem(SORT_BY_VIEW_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

interface AntraegeState {
  programmId: string | null;
  antraege: Antrag[];
  verbuende: Verbund[];
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  search: string;
  activeView: ViewKey;
  /** User-Override pro View. Leer → Default aus DEFAULT_SORT_BY_VIEW. */
  sortByView: Partial<Record<ViewKey, SortKey>>;
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
  setSortForView: (view: ViewKey, key: SortKey) => void;
  setSelectedAktenzeichen: (az: string | null) => void;
  setSelectedVerbundId: (id: string | null) => void;
  backToList: () => void;
}

export function getEffectiveSortKey(
  view: ViewKey,
  overrides: Partial<Record<ViewKey, SortKey>>,
): SortKey {
  return overrides[view] ?? DEFAULT_SORT_BY_VIEW[view];
}

export const useAntraegeStore = create<AntraegeState>((set) => ({
  programmId: null,
  antraege: [],
  verbuende: [],
  selectedAktenzeichen: null,
  selectedVerbundId: null,
  search: '',
  activeView: loadActiveView(),
  sortByView: loadSortByView(),
  loading: false,

  loadAll: async (idb: IDBStore, programmId?: string) => {
    const oldProgrammId = useAntraegeStore.getState().programmId;
    set({ loading: true });
    try {
      const targetId = programmId ?? (await ensureDefaultProgramm(idb)).id;
      const [antraege, verbuende] = await Promise.all([
        listAntraegeByProgramm(idb, targetId),
        listVerbuendeByProgramm(idb, targetId),
      ]);
      // Selektion nur bei tatsächlichem Programm-Wechsel löschen. Beim
      // Initial-Load (oldProgrammId === null) oder beim Reload desselben
      // Programms bleibt die URL-getriebene Selektion erhalten — sonst
      // überschreibt loadAll die vom Router-Effekt eben gesetzte Selektion
      // und der Detail-View verschwindet beim Direkt-Aufruf von
      // /antraege/:az.
      const programmChanged = oldProgrammId !== null && oldProgrammId !== targetId;
      set({
        programmId: targetId,
        antraege,
        verbuende,
        ...(programmChanged ? {
          selectedAktenzeichen: null,
          selectedVerbundId: null,
        } : {}),
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

  setSortForView: (view: ViewKey, key: SortKey) => {
    const current = useAntraegeStore.getState().sortByView;
    const next: Partial<Record<ViewKey, SortKey>> = { ...current };
    if (key === DEFAULT_SORT_BY_VIEW[view]) {
      delete next[view];
    } else {
      next[view] = key;
    }
    saveSortByView(next);
    set({ sortByView: next });
  },

  setSelectedAktenzeichen: (az: string | null) =>
    set({ selectedAktenzeichen: az, selectedVerbundId: null }),

  setSelectedVerbundId: (id: string | null) =>
    set({ selectedVerbundId: id, selectedAktenzeichen: null }),

  backToList: () => set({ selectedAktenzeichen: null, selectedVerbundId: null }),
}));
