import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { ensureDefaultProgramm } from '@/core/services/csv';
import {
  listAntraegeListViewByProgramm,
  listVerbuendeByProgramm,
} from '@/core/services/csv/idb-csv';
import { tfPerfLog, tfPerfStart } from '@/core/utils/tfPerf';
import type { ViewKey } from './views';
import {
  DEFAULT_SORT_BY_VIEW,
  SORT_OPTIONS,
  isSortAllowedForView,
  type SortKey,
  DEFAULT_GROUPING_BY_VIEW,
  GROUPING_OPTIONS,
} from './sort';
import type { GroupingMode } from './antragGroups';

const ACTIVE_VIEW_KEY = 'teamflow_antraege_active_view';
const SORT_BY_VIEW_KEY = 'teamflow_antraege_sort_by_view';
const GROUPING_BY_VIEW_KEY = 'teamflow_antraege_grouping_by_view';

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

const VALID_GROUPING_KEYS = new Set<GroupingMode>(GROUPING_OPTIONS.map(o => o.key));

function loadGroupingByView(): Partial<Record<ViewKey, GroupingMode>> {
  try {
    const raw = localStorage.getItem(GROUPING_BY_VIEW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<ViewKey, GroupingMode>> = {};
    for (const [view, key] of Object.entries(parsed)) {
      if (typeof key === 'string' && VALID_GROUPING_KEYS.has(key as GroupingMode)) {
        out[view as ViewKey] = key as GroupingMode;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveGroupingByView(map: Partial<Record<ViewKey, GroupingMode>>): void {
  try { localStorage.setItem(GROUPING_BY_VIEW_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

interface AntraegeState {
  programmId: string | null;
  /** Schmale Listen-Projektion aus dem `ANTRAEGE_LIST_VIEW`-Store —
   *  ~14 Felder pro Record. Die volle 461-Feld-Variante laedt
   *  `AntragDetail` lazy via `getAntrag(idb, az)`. */
  antraege: AntragListItem[];
  verbuende: Verbund[];
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  search: string;
  activeView: ViewKey;
  /** User-Override pro View. Leer → Default aus DEFAULT_SORT_BY_VIEW. */
  sortByView: Partial<Record<ViewKey, SortKey>>;
  /** User-Override pro View. Leer → Default aus DEFAULT_GROUPING_BY_VIEW. */
  groupingByView: Partial<Record<ViewKey, GroupingMode>>;
  loading: boolean;
  /** Wann der Store zuletzt erfolgreich geladen hat. Für TTL-Skip-Path
   *  in `loadAll` — schnelle Navigations-Wechsel zwischen Home und
   *  Antraege-Seite überspringen den IDB-Read, längere Pausen (z.B. nach
   *  CSV-Import) lösen einen Reload aus. */
  lastLoadedAt: number;
  /**
   * Lädt Antraege + Verbuende für das angegebene Programm. Wird bei
   * Programm-Switch erneut aufgerufen.
   * Wenn `programmId` weggelassen wird: fällt auf `ensureDefaultProgramm()`
   * zurück (Bootstrap-Pfad).
   * `force=true` umgeht den TTL-Skip (z.B. nach CSV-Import).
   */
  loadAll: (idb: IDBStore, programmId?: string, opts?: { force?: boolean }) => Promise<void>;
  setSearch: (s: string) => void;
  setActiveView: (view: ViewKey) => void;
  setSortForView: (view: ViewKey, key: SortKey) => void;
  setGroupingForView: (view: ViewKey, mode: GroupingMode) => void;
  setSelectedAktenzeichen: (az: string | null) => void;
  setSelectedVerbundId: (id: string | null) => void;
  backToList: () => void;
}

/** Session-TTL: innerhalb dieses Fensters wird ein erneuter loadAll-Aufruf
 *  für dasselbe Programm übersprungen. 5 Minuten deckt typische Lese-
 *  Sessions ab — User klickt mehrfach zwischen Home/Antraege/Detail.
 *  Längere Pausen triggern wieder einen frischen IDB-Read (2.6 s bei
 *  13k+ Records mit Multi-CSV-Joins). CSV-Imports umgehen den Skip via
 *  `opts.force=true`. */
const LOAD_ALL_SKIP_TTL_MS = 5 * 60 * 1000;

export function getEffectiveSortKey(
  view: ViewKey,
  overrides: Partial<Record<ViewKey, SortKey>>,
): SortKey {
  const override = overrides[view];
  if (override && isSortAllowedForView(override, view)) return override;
  return DEFAULT_SORT_BY_VIEW[view];
}

export function getEffectiveGroupingMode(
  view: ViewKey,
  overrides: Partial<Record<ViewKey, GroupingMode>>,
): GroupingMode {
  const override = overrides[view];
  if (override) return override;
  return DEFAULT_GROUPING_BY_VIEW[view];
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
  groupingByView: loadGroupingByView(),
  loading: false,
  lastLoadedAt: 0,

  loadAll: async (idb: IDBStore, programmId?: string, opts?: { force?: boolean }) => {
    const end = tfPerfStart('antraege.loadAll');
    const state = useAntraegeStore.getState();
    const oldProgrammId = state.programmId;
    const targetId = programmId ?? (await ensureDefaultProgramm(idb)).id;
    // TTL-Skip: identisches Programm + frische Daten + kein expliziter
    // Force → IDB-Read überspringen. Spart bei Home↔Antraege-Navigation
    // den 13k-Record-Roundtrip und vermeidet die nachgelagerte Memo-
    // Invalidation (neue antraege-Reference triggert sonst alle Hooks).
    if (
      !opts?.force
      && state.programmId === targetId
      && state.antraege.length > 0
      && Date.now() - state.lastLoadedAt < LOAD_ALL_SKIP_TTL_MS
    ) {
      end('skipped (TTL)');
      return;
    }
    set({ loading: true });
    try {
      const tIdb = tfPerfStart('antraege.loadAll → IDB getAll (slim)');
      const [antraege, verbuende] = await Promise.all([
        listAntraegeListViewByProgramm(idb, targetId),
        listVerbuendeByProgramm(idb, targetId),
      ]);
      tIdb(`antraege=${antraege.length} verbuende=${verbuende.length}`);
      const sample = antraege[0];
      if (sample) {
        const bytes = JSON.stringify(sample).length;
        const fields = Object.keys(sample).length;
        tfPerfLog(`antrag-list-view sample: ${bytes} bytes, ${fields} fields (programm=${targetId})`);
      }
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
        lastLoadedAt: Date.now(),
        ...(programmChanged ? {
          selectedAktenzeichen: null,
          selectedVerbundId: null,
        } : {}),
        loading: false,
      });
      end(`n=${antraege.length} programm=${targetId}`);
    } catch (e) {
      set({ loading: false });
      end(`error: ${(e as Error).message}`);
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

  setGroupingForView: (view: ViewKey, mode: GroupingMode) => {
    const current = useAntraegeStore.getState().groupingByView;
    const next: Partial<Record<ViewKey, GroupingMode>> = { ...current };
    if (mode === DEFAULT_GROUPING_BY_VIEW[view]) {
      delete next[view];
    } else {
      next[view] = mode;
    }
    saveGroupingByView(next);
    set({ groupingByView: next });
  },

  setSelectedAktenzeichen: (az: string | null) =>
    set({ selectedAktenzeichen: az, selectedVerbundId: null }),

  setSelectedVerbundId: (id: string | null) =>
    set({ selectedVerbundId: id, selectedAktenzeichen: null }),

  backToList: () => set({ selectedAktenzeichen: null, selectedVerbundId: null }),
}));
