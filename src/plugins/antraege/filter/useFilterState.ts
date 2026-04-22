import { create } from 'zustand';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { ActiveFilter, ActiveFilterValue, FilterDefinition, UserPreset } from '@/core/services/csv';
import {
  listFilters,
  listUserPresets,
  addUserPreset,
  removeUserPreset,
  seedSystemFilters,
  hydrateAdminFiltersFromSmb,
  listUnterprogrammeByProgramm,
} from '@/core/services/csv';

export type FieldValueLabels = Record<string, Record<string, string>>; // feldKey → code → label

interface FilterStateStore {
  programmId: string | null;
  definitions: FilterDefinition[];
  active: ActiveFilter[];
  presets: UserPreset[];
  activePresetId: string | null;
  /** Feld-spezifische Label-Maps (z.B. unterprogramm_id → {code → label}). */
  valueLabels: FieldValueLabels;
  loading: boolean;

  init: (idb: IDBStore, programmId: string) => Promise<void>;
  reload: (idb: IDBStore) => Promise<void>;
  setActiveValue: (filterId: string, value: ActiveFilterValue | null) => void;
  clearFilter: (filterId: string) => void;
  clearAll: () => void;
  savePreset: (idb: IDBStore, name: string, description?: string) => Promise<UserPreset | null>;
  loadPreset: (presetId: string) => void;
  deletePreset: (idb: IDBStore, presetId: string) => Promise<void>;
}

function isEmptyValue(value: ActiveFilterValue | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.values(obj).every(v => v === undefined || v === null || v === '');
  }
  return false;
}

export const useFilterState = create<FilterStateStore>((set, get) => ({
  programmId: null,
  definitions: [],
  active: [],
  presets: [],
  activePresetId: null,
  valueLabels: {},
  loading: false,

  init: async (idb, programmId) => {
    set({ loading: true, programmId });
    try {
      await seedSystemFilters(idb, programmId);
      await hydrateAdminFiltersFromSmb(idb, programmId);
      const [defs, presets, ups] = await Promise.all([
        listFilters(idb, programmId),
        listUserPresets(idb, programmId),
        listUnterprogrammeByProgramm(idb, programmId),
      ]);
      const upLabels: Record<string, string> = {};
      for (const up of ups) {
        if (up.name) upLabels[up.code] = up.name;
      }
      set({
        definitions: defs,
        presets,
        valueLabels: { unterprogramm_id: upLabels },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  reload: async (idb) => {
    const pid = get().programmId;
    if (!pid) return;
    const [defs, presets, ups] = await Promise.all([
      listFilters(idb, pid),
      listUserPresets(idb, pid),
      listUnterprogrammeByProgramm(idb, pid),
    ]);
    const upLabels: Record<string, string> = {};
    for (const up of ups) {
      if (up.name) upLabels[up.code] = up.name;
    }
    set({ definitions: defs, presets, valueLabels: { unterprogramm_id: upLabels } });
  },

  setActiveValue: (filterId, value) => {
    const state = get();
    const isEmpty = isEmptyValue(value);
    const next = state.active.filter(af => af.filterId !== filterId);
    if (!isEmpty && value !== null) {
      next.push({ filterId, value });
    }
    set({ active: next, activePresetId: null });
  },

  clearFilter: (filterId) => {
    set({
      active: get().active.filter(af => af.filterId !== filterId),
      activePresetId: null,
    });
  },

  clearAll: () => {
    set({ active: [], activePresetId: null });
  },

  savePreset: async (idb, name, description) => {
    const state = get();
    if (!state.programmId) return null;
    const preset: UserPreset = {
      id: `preset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      programm_id: state.programmId,
      name,
      description,
      snapshot: state.active.map(af => ({ ...af })),
      created_at: new Date().toISOString(),
    };
    await addUserPreset(idb, preset);
    set({
      presets: [...state.presets, preset],
      activePresetId: preset.id,
    });
    return preset;
  },

  loadPreset: (presetId) => {
    const preset = get().presets.find(p => p.id === presetId);
    if (!preset) return;
    set({
      active: preset.snapshot.map(af => ({ ...af })),
      activePresetId: presetId,
    });
  },

  deletePreset: async (idb, presetId) => {
    const pid = get().programmId;
    if (!pid) return;
    await removeUserPreset(idb, pid, presetId);
    set({
      presets: get().presets.filter(p => p.id !== presetId),
      activePresetId: get().activePresetId === presetId ? null : get().activePresetId,
    });
  },
}));
