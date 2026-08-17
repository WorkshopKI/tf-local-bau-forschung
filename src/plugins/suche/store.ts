/**
 * Suche-Plugin Store: persistierte UI-Praeferenzen (Spalten-Sichtbarkeit).
 *
 * Pattern analog zum Antraege-Store: Zustand + localStorage-Validate-on-Load.
 * localStorage ist hier ausreichend (Daten klein, OK unter `file://`, siehe
 * CLAUDE.md "localStorage OK for simple flags").
 *
 * AUSNAHME seit v3.50: `query`, die Facettenwahl, die abgewählten Wörter und der
 * Frageplan sind SITZUNGS-lokal und bewusst NICHT in localStorage. Sie liegen
 * hier statt in `useState`, weil der Klick auf einen Treffer die Suchseite
 * ausbaut — mit lokalem State war der Weg zurück eine Sackgasse (leeres Feld,
 * keine Treffer). Seit v4.83 tragen sie einen Spiegel in `sessionStorage`
 * ([sitzungsAnfrage.ts](./sitzungsAnfrage.ts)): als reiner Modul-State starben
 * sie bei jedem Neuladen, und genau dann war die Trefferliste unerreichbar.
 * Weiterhin NICHT in localStorage — ein Kaltstart soll im Leerzustand landen und
 * nicht in einer Suche von vorgestern.
 *
 * Ansicht, Sortierung und Dichte sind das Gegenteil: sie beschreiben, wie
 * jemand ARBEITET, nicht wonach er gerade sucht — die überleben den Neustart.
 */
import { create } from 'zustand';
import {
  SEARCH_COLUMNS,
  DEFAULT_VISIBLE_COLUMN_KEYS,
  LOCKED_COLUMN_KEYS,
} from './columns';
import { pushRecentSearch, MAX_RECENT_SEARCHES } from './suchseite-utils';
import { DEFAULT_BEGRUENDUNG_INSTRUCTION } from './analyse/stages/begruendung';
import {
  parseSortierung, parseDichte,
  type SucheSortierung, type SucheDichte,
} from './darstellungsAchsen';
import type { FacettenWahl } from './facetten';
import {
  liesFacettenWahl, liesFrageplan, liesQuery, liesWortliste, merke,
  S_BEGRIFFE, S_FACETTEN, S_PLAN, S_QUERY, S_WOERTER,
} from './sitzungsAnfrage';
import type { Frageplan } from '@/core/services/search/frageplan';

const VISIBLE_COLUMNS_KEY = 'teamflow_suche_visible_columns';
const RECENT_SEARCHES_KEY = 'teamflow_suche_recent_queries';
const ANALYSE_PROMPT_KEY = 'teamflow_suche_analyse_prompt';
const ANSICHT_KEY = 'teamflow_suche_ansicht';
const SORTIERUNG_KEY = 'teamflow_suche_sortierung';
const DICHTE_KEY = 'teamflow_suche_dichte';

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
  /** Gesetzte Facetten — sitzungs-lokal, überlebt den Sprung ins Detail. */
  facettenWahl: FacettenWahl;
  setFacettenWahl: (w: FacettenWahl) => void;
  /**
   * In der Deutungszeile abgewählte Suchwörter, klein geschrieben.
   * Sitzungs-lokal und an DIESE Anfrage gebunden — `setQuery` räumt sie mit.
   */
  abgewaehlteWoerter: string[];
  toggleWort: (wort: string) => void;
  /**
   * Der Frageplan der natürlichsprachigen Suche — sitzungs-lokal wie die Anfrage.
   *
   * `null` heißt „Stichwortsuche": die Wortlaut-Stufe zerlegt dann wieder die
   * Eingabe. Der Plan trägt die Frage, aus der er entstand, und `setQuery`
   * verwirft ihn, sobald der Feldtext davon abweicht — eine Deutungszeile, die
   * eine andere Frage beschreibt als die im Feld, ist eine Legende, die lügt.
   */
  frageplan: Frageplan | null;
  setFrageplan: (p: Frageplan | null) => void;
  /** In der Deutungszeile abgewählte LEITBEGRIFFE des Plans, klein geschrieben. */
  abgewaehlteBegriffe: string[];
  toggleBegriff: (begriff: string) => void;
  /** Läuft gerade die Übersetzung? Nur für die Rückmeldung im Feld. */
  planLaeuft: boolean;
  setPlanLaeuft: (an: boolean) => void;
  /** Meldung des letzten Übersetzungsversuchs, oder `null`. */
  planFehler: string | null;
  setPlanFehler: (f: string | null) => void;
  /** Liste oder Tabelle. Persistiert: eine Arbeitsgewohnheit. */
  ansicht: 'liste' | 'tabelle';
  setAnsicht: (a: 'liste' | 'tabelle') => void;
  sortierung: SucheSortierung;
  setSortierung: (s: SucheSortierung) => void;
  dichte: SucheDichte;
  setDichte: (d: SucheDichte) => void;
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

  // Sitzungs-lokal, mit Spiegel in sessionStorage — Begründung siehe Modul-Kopf.
  query: liesQuery(),
  setQuery: (query: string) => {
    // Neue Anfrage ⇒ die Wort-Abwahl der alten ist hinfällig. Sonst schnitte ein
    // vor zwei Suchen abgewähltes Wort still an der neuen Anfrage mit.
    const woerter = get().abgewaehlteWoerter;
    const plan = get().frageplan;
    // Und der Plan der alten Frage genauso: weicht der Feldtext von der Frage
    // ab, aus der er entstand, beschriebe er etwas anderes als das, was im Feld
    // steht. Er stirbt beim ersten Tastendruck — die Suche fällt damit auf die
    // Stichwortsuche zurück, bis eine neue Frage gestellt wird.
    const planHinfaellig = plan !== null && plan.frage !== query.trim();
    merke(S_QUERY, query);
    if (woerter.length > 0) merke(S_WOERTER, []);
    if (planHinfaellig) { merke(S_PLAN, null); merke(S_BEGRIFFE, []); }
    set({
      query,
      ...(woerter.length > 0 ? { abgewaehlteWoerter: [] } : {}),
      ...(planHinfaellig
        ? { frageplan: null, abgewaehlteBegriffe: [], planFehler: null }
        : {}),
    });
  },

  facettenWahl: liesFacettenWahl(),
  setFacettenWahl: (facettenWahl: FacettenWahl) => {
    merke(S_FACETTEN, facettenWahl);
    set({ facettenWahl });
  },

  abgewaehlteWoerter: liesWortliste(S_WOERTER),
  toggleWort: (wort: string) => {
    const klein = wort.toLowerCase();
    const aktuell = get().abgewaehlteWoerter;
    const next = aktuell.includes(klein)
      ? aktuell.filter(w => w !== klein)
      : [...aktuell, klein];
    merke(S_WOERTER, next);
    set({ abgewaehlteWoerter: next });
  },

  frageplan: liesFrageplan(),
  // Ein neuer Plan räumt die Abwahl des vorigen mit weg: die Leitbegriffe sind
  // andere, und ein gemerkter Name träfe bestenfalls zufällig zu.
  setFrageplan: (frageplan) => {
    merke(S_PLAN, frageplan);
    merke(S_BEGRIFFE, []);
    set({ frageplan, abgewaehlteBegriffe: [] });
  },

  abgewaehlteBegriffe: liesWortliste(S_BEGRIFFE),
  toggleBegriff: (begriff: string) => {
    const klein = begriff.toLowerCase();
    const aktuell = get().abgewaehlteBegriffe;
    const next = aktuell.includes(klein)
      ? aktuell.filter(b => b !== klein)
      : [...aktuell, klein];
    merke(S_BEGRIFFE, next);
    set({ abgewaehlteBegriffe: next });
  },

  planLaeuft: false,
  setPlanLaeuft: (planLaeuft) => set({ planLaeuft }),
  planFehler: null,
  setPlanFehler: (planFehler) => set({ planFehler }),

  ansicht: ladeAnsicht(),
  setAnsicht: (ansicht) => {
    try { localStorage.setItem(ANSICHT_KEY, ansicht); } catch { /* ignore */ }
    set({ ansicht });
  },

  sortierung: parseSortierung(lies(SORTIERUNG_KEY)),
  setSortierung: (sortierung) => {
    try { localStorage.setItem(SORTIERUNG_KEY, sortierung); } catch { /* ignore */ }
    set({ sortierung });
  },

  dichte: parseDichte(lies(DICHTE_KEY)),
  setDichte: (dichte) => {
    try { localStorage.setItem(DICHTE_KEY, dichte); } catch { /* ignore */ }
    set({ dichte });
  },
}));

function lies(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function ladeAnsicht(): 'liste' | 'tabelle' {
  return lies(ANSICHT_KEY) === 'tabelle' ? 'tabelle' : 'liste';
}
