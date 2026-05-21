/**
 * Suche-Plugin Store: persistierte UI-Praeferenzen (Spalten-Sichtbarkeit).
 *
 * Pattern analog zum Antraege-Store: Zustand + localStorage-Validate-on-Load.
 * localStorage ist hier ausreichend (Daten klein, OK unter `file://`, siehe
 * CLAUDE.md "localStorage OK for simple flags").
 */
import { create } from 'zustand';
import {
  SEARCH_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  LOCKED_COLUMN_KEYS,
} from './columns';

const VISIBLE_COLUMNS_KEY = 'teamflow_suche_visible_columns';

const VALID_KEYS: ReadonlySet<string> = new Set(SEARCH_COLUMNS.map(c => c.key));

function loadVisibleColumns(): string[] {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_KEY);
    if (!raw) return DEFAULT_VISIBLE_COLUMN_KEYS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMN_KEYS;
    const keys = parsed.filter((k): k is string => typeof k === 'string' && VALID_KEYS.has(k));
    // Locked-Spalten zwingend ergaenzen — sonst kann der User durch Edit der
    // localStorage versehentlich locked-Spalten ausblenden.
    for (const lockedKey of LOCKED_COLUMN_KEYS) {
      if (!keys.includes(lockedKey)) keys.push(lockedKey);
    }
    return keys;
  } catch {
    return DEFAULT_VISIBLE_COLUMN_KEYS;
  }
}

function saveVisibleColumns(keys: string[]): void {
  try { localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(keys)); } catch { /* ignore */ }
}

interface SucheState {
  visibleColumns: string[];
  setVisibleColumns: (keys: string[]) => void;
  toggleColumn: (key: string) => void;
}

export const useSucheStore = create<SucheState>((set, get) => ({
  visibleColumns: loadVisibleColumns(),

  setVisibleColumns: (keys: string[]) => {
    // Locked enforced auch beim direkten Set.
    const next = [...keys];
    for (const lockedKey of LOCKED_COLUMN_KEYS) {
      if (!next.includes(lockedKey)) next.push(lockedKey);
    }
    saveVisibleColumns(next);
    set({ visibleColumns: next });
  },

  toggleColumn: (key: string) => {
    if (LOCKED_COLUMN_KEYS.includes(key)) return;
    const current = get().visibleColumns;
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    saveVisibleColumns(next);
    set({ visibleColumns: next });
  },
}));
