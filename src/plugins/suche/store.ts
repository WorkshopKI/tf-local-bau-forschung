/**
 * Suche-Plugin Store: persistierte UI-Praeferenzen (Spalten-Sichtbarkeit).
 *
 * Pattern analog zum Antraege-Store: Zustand + localStorage-Validate-on-Load.
 * localStorage ist hier ausreichend (Daten klein, OK unter `file://`, siehe
 * CLAUDE.md "localStorage OK for simple flags").
 *
 * AUSNAHME seit v3.50: die drei Felder `query` / `typeFilter` /
 * `antragstypFilter` sind SITZUNGS-lokal und bewusst NICHT in localStorage. Sie
 * liegen hier statt in `useState`, weil der Klick auf einen Treffer die
 * Suchseite ausbaut — mit lokalem State war der Weg zurück eine Sackgasse
 * (leeres Feld, keine Treffer). Nicht persistiert, damit ein Kaltstart weiter
 * auf dem Leerzustand landet und nicht in einer Suche von vorgestern.
 */
import { create } from 'zustand';
import type { KategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import type { SuchePillFilterId } from './suchseite-utils';
import {
  SEARCH_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  LOCKED_COLUMN_KEYS,
} from './columns';
import { pushRecentSearch, MAX_RECENT_SEARCHES } from './suchseite-utils';
import { DEFAULT_BEGRUENDUNG_INSTRUCTION } from './analyse/stages/begruendung';

const VISIBLE_COLUMNS_KEY = 'teamflow_suche_visible_columns';
const RECENT_SEARCHES_KEY = 'teamflow_suche_recent_queries';
const ANALYSE_PROMPT_KEY = 'teamflow_suche_analyse_prompt';

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

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function saveRecentSearches(list: string[]): void {
  try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function loadAnalysePrompt(): string {
  try {
    const raw = localStorage.getItem(ANALYSE_PROMPT_KEY);
    if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  } catch { /* ignore */ }
  return DEFAULT_BEGRUENDUNG_INSTRUCTION;
}

function saveAnalysePrompt(s: string): void {
  try { localStorage.setItem(ANALYSE_PROMPT_KEY, s); } catch { /* ignore */ }
}

interface SucheState {
  visibleColumns: string[];
  setVisibleColumns: (keys: string[]) => void;
  toggleColumn: (key: string) => void;
  /** Zuletzt verwendete Such-/Analyse-Anfragen (most-recent-first). */
  recentSearches: string[];
  addRecentSearch: (q: string) => void;
  removeRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
  /** Editierbarer Anweisungstext für „Treffer begründen" (Begründung). */
  analysePrompt: string;
  setAnalysePrompt: (s: string) => void;
  /** Aktuelle Suchanfrage — sitzungs-lokal, siehe Modul-Kopf. */
  query: string;
  setQuery: (q: string) => void;
  /** Treffer-Typ-Pille — sitzungs-lokal, überlebt den Sprung ins Detail. */
  typeFilter: SuchePillFilterId;
  setTypeFilter: (id: SuchePillFilterId) => void;
  /** Antragstyp-Segment — sitzungs-lokal, überlebt den Sprung ins Detail. */
  antragstypFilter: KategorieLabel;
  setAntragstypFilter: (label: KategorieLabel) => void;
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

  recentSearches: loadRecentSearches(),

  addRecentSearch: (q: string) => {
    const current = get().recentSearches;
    const next = pushRecentSearch(current, q, MAX_RECENT_SEARCHES);
    if (next === current) return; // No-op (z.B. len<2)
    saveRecentSearches(next);
    set({ recentSearches: next });
  },

  removeRecentSearch: (q: string) => {
    const next = get().recentSearches.filter(e => e !== q);
    saveRecentSearches(next);
    set({ recentSearches: next });
  },

  clearRecentSearches: () => {
    saveRecentSearches([]);
    set({ recentSearches: [] });
  },

  analysePrompt: loadAnalysePrompt(),

  setAnalysePrompt: (s: string) => {
    saveAnalysePrompt(s);
    set({ analysePrompt: s });
  },

  // Sitzungs-lokal (kein localStorage) — Begründung siehe Modul-Kopf.
  query: '',
  setQuery: (query: string) => set({ query }),

  typeFilter: '',
  setTypeFilter: (typeFilter: SuchePillFilterId) => set({ typeFilter }),

  antragstypFilter: 'Alle',
  setAntragstypFilter: (antragstypFilter: KategorieLabel) => set({ antragstypFilter }),
}));
