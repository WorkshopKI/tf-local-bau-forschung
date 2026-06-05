/**
 * Sichtbare Spalten der Förderanträge-Tabellen-Ansicht ("compact"-View-Mode).
 *
 * Eigener Zustand-Store (kein direktes `useColumnVisibility`), weil der
 * "Spalten"-Picker im Header (`AntraegeHeader`) und die Tabelle in
 * `AntraegeMain` Geschwister sind und denselben State reaktiv teilen müssen —
 * zwei `useColumnVisibility`-Instanzen würden nur über Reload syncen.
 *
 * Persistenz: localStorage `teamflow_antraege_table_columns` (JSON-Array von
 * Spalten-Keys). Locked-Spalten werden bei Load + Toggle erzwungen. Muster
 * 1:1 aus `src/plugins/suche/store.ts`.
 */
import { create } from 'zustand';
import {
  ANTRAG_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  LOCKED_COLUMN_KEYS,
} from './tableColumns';

const VISIBLE_COLUMNS_KEY = 'teamflow_antraege_table_columns';
const VALID_KEYS: ReadonlySet<string> = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));

function loadVisibleColumns(): string[] {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_KEY);
    if (!raw) return [...DEFAULT_VISIBLE_COLUMN_KEYS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_COLUMN_KEYS];
    const keys = parsed.filter((k): k is string => typeof k === 'string' && VALID_KEYS.has(k));
    for (const lockedKey of LOCKED_COLUMN_KEYS) {
      if (!keys.includes(lockedKey)) keys.push(lockedKey);
    }
    return keys;
  } catch {
    return [...DEFAULT_VISIBLE_COLUMN_KEYS];
  }
}

function saveVisibleColumns(keys: string[]): void {
  try { localStorage.setItem(VISIBLE_COLUMNS_KEY, JSON.stringify(keys)); } catch { /* ignore */ }
}

interface AntraegeColumnsState {
  visibleColumns: string[];
  setVisibleColumns: (keys: string[]) => void;
  toggleColumn: (key: string) => void;
}

export const useAntraegeColumnsStore = create<AntraegeColumnsState>((set, get) => ({
  visibleColumns: loadVisibleColumns(),
  setVisibleColumns: (keys: string[]) => {
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
