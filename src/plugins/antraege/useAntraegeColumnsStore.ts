/**
 * Sichtbare Spalten der Förderanträge-Tabellen-Ansicht ("compact"-View-Mode).
 *
 * Eigener Zustand-Store (kein direktes `useColumnVisibility`), damit der
 * "Spalten"-Picker und die Tabelle denselben State reaktiv teilen. Beide
 * sitzen seit der UI-Verlagerung in `AntraegeTable` (Picker direkt über der
 * Tabelle); der globale Store bleibt, weil andere Stellen (z.B. Export)
 * dieselbe Sichtbarkeit lesen könnten und zwei Hook-Instanzen nur über
 * Reload syncen würden.
 *
 * Persistenz: localStorage `teamflow_antraege_table_columns` (JSON-Array von
 * Spalten-Keys). Locked-Spalten werden bei Load + Toggle erzwungen. Muster
 * 1:1 aus `src/plugins/suche/store.ts`.
 */
import { create } from 'zustand';
import {
  ANTRAG_TABLE_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  KATEGORIE_COLUMN_PREFIX,
  LOCKED_COLUMN_KEYS,
} from './tableColumns';

const VISIBLE_COLUMNS_KEY = 'teamflow_antraege_table_columns';
const STATISCHE_KEYS: ReadonlySet<string> = new Set(ANTRAG_TABLE_COLUMNS.map(c => c.key));

/**
 * Gültig sind die festen Spalten UND die Ordner-Spalten des Statuskatalogs.
 * Letztere sind nicht im Code aufzählbar — welche es gibt, entscheidet die
 * Kuration. Eine feste Schlüsselliste würde sie beim Laden herausfiltern, und
 * die Auswahl wäre nach jedem Reload weg.
 */
function istGueltigerKey(key: string): boolean {
  return STATISCHE_KEYS.has(key) || key.startsWith(KATEGORIE_COLUMN_PREFIX);
}

function loadVisibleColumns(): string[] {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_KEY);
    if (!raw) return [...DEFAULT_VISIBLE_COLUMN_KEYS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_VISIBLE_COLUMN_KEYS];
    const keys = parsed.filter((k): k is string => typeof k === 'string' && istGueltigerKey(k));
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
