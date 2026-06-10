import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import { ensureDefaultProgramm } from '@/core/services/csv';
import {
  listAntraegeListViewByProgramm,
  listVerbuendeByProgramm,
  listAllAntraegeListView,
} from '@/core/services/csv/idb-csv';
import { tfPerfLog, tfPerfStart } from '@/core/utils/tfPerf';
import { buildNetzwerkNameIndex } from './netzwerk';
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
import type { TableGroupingMode } from './tableGrouping';
import {
  DEFAULT_VIEW_MODE,
  loadViewModeByTab,
  saveViewModeByTab,
  type ViewMode,
} from './viewModes';

const ACTIVE_VIEW_KEY = 'teamflow_antraege_active_view';
const SORT_BY_VIEW_KEY = 'teamflow_antraege_sort_by_view';
const GROUPING_BY_VIEW_KEY = 'teamflow_antraege_grouping_by_view';
const TABLE_GROUPING_BY_VIEW_KEY = 'teamflow_antraege_table_grouping_by_view';
const VIEW_MODE_BY_TAB_KEY = 'teamflow_antraege_view_mode_by_tab';

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

const VALID_TABLE_GROUPING_KEYS = new Set<TableGroupingMode>(['none', 'verbund', 'status']);

function loadTableGroupingByView(): Partial<Record<ViewKey, TableGroupingMode>> {
  try {
    const raw = localStorage.getItem(TABLE_GROUPING_BY_VIEW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<ViewKey, TableGroupingMode>> = {};
    for (const [view, key] of Object.entries(parsed)) {
      if (typeof key === 'string' && VALID_TABLE_GROUPING_KEYS.has(key as TableGroupingMode)) {
        out[view as ViewKey] = key as TableGroupingMode;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveTableGroupingByView(map: Partial<Record<ViewKey, TableGroupingMode>>): void {
  try { localStorage.setItem(TABLE_GROUPING_BY_VIEW_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/** Quellen, die die Hybrid-Suche aus Datenmangel nicht beitragen konnte —
 *  von der UI in einen Hinweis-Banner uebersetzt. `embedding` haengt am
 *  Auslastungs-Korpus, `dms` am Phase-2-Suchindex. */
export type HybridUnavailableSource = 'embedding' | 'dms';

export interface HybridSearchState {
  /** Aktenzeichen-Set mit Hybrid-Treffern (Substring auf VB/TV/Abstract +
   *  Embedding-Top-K + DMS-Volltext-Treffer). `null` = kein Filter aktiv
   *  (Query leer oder Hook noch nicht initialisiert), `Set` = aktiv. */
  matchedAkz: Set<string> | null;
  /** True solange Embedding/DMS-Auswertung laeuft. Substring laeuft sync und
   *  taucht hier nicht auf. */
  loading: boolean;
  /** Quellen, die wegen fehlender Daten nicht ausgewertet werden konnten. */
  unavailable: HybridUnavailableSource[];
  /** True waehrend der Embedding-Korpus vom SMB-Share heruntergeladen wird
   *  (frisch installierter prod-Rechner). UI zeigt einen freundlichen Hinweis
   *  statt des „inaktiv"-Banners. */
  downloadingCorpus: boolean;
  /** Optionaler Fortschritt waehrend Korpus-Download. */
  downloadProgress?: { done: number; total: number };
}

interface AntraegeState {
  programmId: string | null;
  /** Schmale Listen-Projektion aus dem `ANTRAEGE_LIST_VIEW`-Store —
   *  ~14 Felder pro Record. Die volle 461-Feld-Variante laedt
   *  `TvDetailBlock` lazy via `getAntrag(idb, az)`. */
  antraege: AntragListItem[];
  verbuende: Verbund[];
  /** Aus `verbuende` abgeleitete Map für O(1)-Lookup nach `verbund_id`.
   *  Wird in `loadAll` parallel zur Verbund-Liste aufgebaut, damit Renderer
   *  (CardGrid/GroupedList) sie an `buildAntragGroups` weiter-
   *  reichen können, ohne pro Aufruf neu zu mappen. */
  verbundById: Map<string, Verbund>;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  search: string;
  /** Such-Override: wenn `true` UND `search` non-empty → der Bearbeiter-Filter
   *  (Profil-Kürzel) wird in `useFilteredAntraege` übersprungen, damit der User
   *  auch in fremden Anträgen suchen kann. Wird in `setSearch` automatisch auf
   *  `false` zurückgesetzt sobald der Suchstring geleert wird. */
  searchIgnoreBearbeiterFilter: boolean;
  /** State der Hybrid-Suche (Substring + Embedding + DMS-Index). Wird vom
   *  Hook `useAntraegeHybridSearch` in `AntraegePage` gepflegt; Konsumenten
   *  sind `useFilteredAntraege` (Filter) und `AntraegeHeader` (Spinner +
   *  Banner). */
  hybridSearch: HybridSearchState;
  activeView: ViewKey;
  /** User-Override pro View. Leer → Default aus DEFAULT_SORT_BY_VIEW. */
  sortByView: Partial<Record<ViewKey, SortKey>>;
  /** User-Override pro View. Leer → Default aus DEFAULT_GROUPING_BY_VIEW. */
  groupingByView: Partial<Record<ViewKey, GroupingMode>>;
  /** Eigener Gruppierungs-Slot für die Tabellen-Ansicht (Compact-Modus).
   *  Getrennt von `groupingByView`, weil die Optionen abweichen (Verbund nur
   *  hier, NW/NW-Größe nur in der List-View). Leer → Default `'none'`. */
  tableGroupingByView: Partial<Record<ViewKey, TableGroupingMode>>;
  /** User-Override pro View. Leer → Default `DEFAULT_VIEW_MODE` ('list'). */
  viewModeByTab: Partial<Record<ViewKey, ViewMode>>;
  /** Cross-Programm-Index: 4-Ziffer-Netzwerk-ID → Netzwerk-Name (akronym des
   *  Lead-Antrags). Gefüllt einmal pro Session via `loadNetzwerkNameIndex`. */
  netzwerkNameById: Map<string, string>;
  /** True sobald der Index einmal aufgebaut wurde (auch wenn leer). Verhindert
   *  Re-Fetches bei jedem Programm-Switch. */
  netzwerkNameIndexLoaded: boolean;
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
  setSearchIgnoreBearbeiterFilter: (v: boolean) => void;
  /** Partial-Merger: ueberschreibt nur die uebergebenen Felder, lasst den
   *  Rest unangetastet. Erlaubt z.B. `setHybridSearch({ downloadingCorpus: true })`
   *  ohne das laufende `matchedAkz`/`loading`-State versehentlich zu nullen. */
  setHybridSearch: (state: Partial<HybridSearchState>) => void;
  setActiveView: (view: ViewKey) => void;
  setSortForView: (view: ViewKey, key: SortKey) => void;
  setGroupingForView: (view: ViewKey, mode: GroupingMode) => void;
  setTableGroupingForView: (view: ViewKey, mode: TableGroupingMode) => void;
  setViewModeForTab: (view: ViewKey, mode: ViewMode) => void;
  setSelectedAktenzeichen: (az: string | null) => void;
  setSelectedVerbundId: (id: string | null) => void;
  backToList: () => void;
  /** Lädt einmal pro Session den Cross-Programm-Netzwerk-Namen-Index aus
   *  dem `ANTRAEGE_LIST_VIEW`-Store. Idempotent — Folge-Aufrufe sind No-Ops. */
  loadNetzwerkNameIndex: (idb: IDBStore) => Promise<void>;
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

export function getEffectiveTableGroupingMode(
  view: ViewKey,
  overrides: Partial<Record<ViewKey, TableGroupingMode>>,
): TableGroupingMode {
  return overrides[view] ?? 'none';
}

export function getEffectiveViewMode(
  view: ViewKey,
  overrides: Partial<Record<ViewKey, ViewMode>>,
): ViewMode {
  const override = overrides[view];
  return override ?? DEFAULT_VIEW_MODE;
}

export const useAntraegeStore = create<AntraegeState>((set) => ({
  programmId: null,
  antraege: [],
  verbuende: [],
  verbundById: new Map<string, Verbund>(),
  selectedAktenzeichen: null,
  selectedVerbundId: null,
  search: '',
  searchIgnoreBearbeiterFilter: false,
  hybridSearch: { matchedAkz: null, loading: false, unavailable: [], downloadingCorpus: false },
  activeView: loadActiveView(),
  sortByView: loadSortByView(),
  groupingByView: loadGroupingByView(),
  tableGroupingByView: loadTableGroupingByView(),
  viewModeByTab: loadViewModeByTab(VIEW_MODE_BY_TAB_KEY),
  netzwerkNameById: new Map<string, string>(),
  netzwerkNameIndexLoaded: false,
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
      // Always-on-Timing (v2.62.5): tfPerf ist in Builds stumm — unter file://
      // ist die Console die einzige Spur, wo das Cold-Start-Budget hingeht.
      const t0 = performance.now();
      const [antraege, verbuende] = await Promise.all([
        listAntraegeListViewByProgramm(idb, targetId),
        listVerbuendeByProgramm(idb, targetId),
      ]);
      console.info(`[antraege] loadAll: ${antraege.length} Anträge (slim) in ${Math.round(performance.now() - t0)} ms`);
      tIdb(`antraege=${antraege.length} verbuende=${verbuende.length}`);
      const sample = antraege[0];
      if (sample) {
        const bytes = JSON.stringify(sample).length;
        const fields = Object.keys(sample).length;
        tfPerfLog(`antrag-list-view sample: ${bytes} bytes, ${fields} fields (programm=${targetId})`);
      }
      // Netzwerk-Namen-Index einmal pro Session asynchron mitladen — der
      // Index ist programm-übergreifend (Netzwerk-Leads liegen meist in
      // anderen Programmen als die TVs), darum nicht in der Hauptlade-
      // Sequenz, sondern als Side-Channel ohne Block.
      void useAntraegeStore.getState().loadNetzwerkNameIndex(idb);
      // Selektion nur bei tatsächlichem Programm-Wechsel löschen. Beim
      // Initial-Load (oldProgrammId === null) oder beim Reload desselben
      // Programms bleibt die URL-getriebene Selektion erhalten — sonst
      // überschreibt loadAll die vom Router-Effekt eben gesetzte Selektion
      // und der Detail-View verschwindet beim Direkt-Aufruf von
      // /antraege/:az.
      const programmChanged = oldProgrammId !== null && oldProgrammId !== targetId;
      const verbundById = new Map<string, Verbund>();
      for (const v of verbuende) verbundById.set(v.verbund_id, v);
      set({
        programmId: targetId,
        antraege,
        verbuende,
        verbundById,
        // TTL nur „armen", wenn wirklich Daten geladen wurden. Ein leerer
        // Erst-Load (Cold-Start: IDB noch nicht vom Snapshot-Sync befüllt) darf
        // den nächsten loadAll NICHT 5 Min blockieren — sonst bleibt die UI bis
        // zum manuellen Reload leer, obwohl der Sync die IDB inzwischen füllt (v2.21.3).
        lastLoadedAt: antraege.length > 0 ? Date.now() : 0,
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

  setSearch: (s: string) => set(state => ({
    search: s,
    // Wenn der User die Suche leert, das Bearbeiter-Override automatisch
    // zurücksetzen — sonst bleibt der Filter heimlich für die naechste
    // Eingabe deaktiviert und die Liste zeigt voellig andere Anträge.
    searchIgnoreBearbeiterFilter: s.trim() === '' ? false : state.searchIgnoreBearbeiterFilter,
  })),

  setSearchIgnoreBearbeiterFilter: (v: boolean) => set({ searchIgnoreBearbeiterFilter: v }),

  setHybridSearch: (state: Partial<HybridSearchState>) => set(s => ({
    hybridSearch: { ...s.hybridSearch, ...state },
  })),

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

  setTableGroupingForView: (view: ViewKey, mode: TableGroupingMode) => {
    const current = useAntraegeStore.getState().tableGroupingByView;
    const next: Partial<Record<ViewKey, TableGroupingMode>> = { ...current };
    if (mode === 'none') {
      delete next[view];
    } else {
      next[view] = mode;
    }
    saveTableGroupingByView(next);
    set({ tableGroupingByView: next });
  },

  setViewModeForTab: (view: ViewKey, mode: ViewMode) => {
    const current = useAntraegeStore.getState().viewModeByTab;
    const next: Partial<Record<ViewKey, ViewMode>> = { ...current };
    if (mode === DEFAULT_VIEW_MODE) {
      delete next[view];
    } else {
      next[view] = mode;
    }
    saveViewModeByTab(VIEW_MODE_BY_TAB_KEY, next);
    set({ viewModeByTab: next });
  },

  setSelectedAktenzeichen: (az: string | null) =>
    set({ selectedAktenzeichen: az, selectedVerbundId: null }),

  setSelectedVerbundId: (id: string | null) =>
    set({ selectedVerbundId: id, selectedAktenzeichen: null }),

  backToList: () => set({ selectedAktenzeichen: null, selectedVerbundId: null }),

  loadNetzwerkNameIndex: async (idb: IDBStore) => {
    const state = useAntraegeStore.getState();
    if (state.netzwerkNameIndexLoaded) return;
    const end = tfPerfStart('antraege.loadNetzwerkNameIndex');
    try {
      const all = await listAllAntraegeListView(idb);
      const map = buildNetzwerkNameIndex(all);
      set({ netzwerkNameById: map, netzwerkNameIndexLoaded: true });
      end(`names=${map.size} scanned=${all.length}`);
    } catch (e) {
      // Best-effort: bei Fehler trotzdem als geladen markieren, damit nicht
      // jeder Render erneut versucht. Caller fällt auf 4-Ziffer-ID zurück.
      set({ netzwerkNameIndexLoaded: true });
      end(`error: ${(e as Error).message}`);
    }
  },
}));
