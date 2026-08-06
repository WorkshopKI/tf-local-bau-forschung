/**
 * Filter-/Sort-/Spalten-Pipeline der Suche (Konsolidierung 2026-07 aus SuchSeite.tsx
 * extrahiert — die zweite der drei TODO-Verantwortungs-Grenzen). Kapselt den
 * gesamten abgeleiteten Zustand: von den rohen `searchResults` (+ optionaler
 * KI-Begründung) über Pill-/Antragstyp-/Spalten-Filter und Sortierung bis zur
 * `sorted`-Liste, den sichtbaren Spalten und den Analyse-Kandidaten.
 *
 * Verhaltens-invariant: reine Verschiebung der bisherigen SuchSeite-Logik, keine
 * Änderung der Berechnung.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { facettenBasis, zaehleFacette, type SortableColumn } from '@/components/data-table';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { KategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import {
  SEARCH_COLUMNS, BEGRUENDUNG_COLUMN, getColumnByKey, getColumnFilterValue, type SearchColumn,
} from './columns';
import {
  matchesPillFilter, compareValues, countResultsByType, SUCHE_COLLATOR,
  getSucheAntragstypItems, matchesSucheAntragstyp, type SuchePillFilterId,
} from './suchseite-utils';

type FilterId = SuchePillFilterId;

const DEFAULT_SORT_KEY = 'score';
const COLUMN_WIDTHS_KEY = 'teamflow_suche_column_widths';
const MIN_COLUMN_WIDTH = 60;
/** Obergrenze der Treffer, die „Mit KI analysieren" begründet (Kosten/Tempo). */
const ANALYSE_MAX_RESULTS = 50;

function loadColumnWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COLUMN_WIDTHS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= MIN_COLUMN_WIDTH) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export interface UseSearchResultsParams {
  searchResults: UnifiedSearchResult[];
  /** KI-Begründungen per Result-`id` (null = keine Analyse aktiv). */
  begruendungById: Record<string, string> | null;
  analyseActive: boolean;
  visibleColumns: string[];
}

export interface UseSearchResultsReturn {
  dataSource: UnifiedSearchResult[];
  typeFilter: FilterId;
  setTypeFilter: (id: FilterId) => void;
  antragstypFilter: KategorieLabel;
  setAntragstypFilter: (label: KategorieLabel) => void;
  filterChips: Array<{ id: FilterId; label: string; count: number }>;
  antragstypItems: ReturnType<typeof getSucheAntragstypItems>;
  antragstypApplicable: boolean;
  sorted: UnifiedSearchResult[];
  analyseResults: UnifiedSearchResult[];
  visibleColumnDefs: SearchColumn[];
  filterCandidatesByColumn: Record<string, string[]>;
  /** Trefferzahl je Wert der Spalte — gerufen nur fuer das offene Dropdown. */
  filterCountsByColumn: (key: string) => ReadonlyMap<string, number>;
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (key: string) => void;
  columnFilters: Record<string, Set<string>>;
  handleColumnFilterChange: (key: string, values: Set<string>) => void;
  columnWidths: Record<string, number>;
  handleColumnWidthChange: (key: string, width: number) => void;
}

export function useSearchResults(params: UseSearchResultsParams): UseSearchResultsReturn {
  const { searchResults, begruendungById, analyseActive, visibleColumns } = params;

  const [typeFilter, setTypeFilter] = useState<FilterId>('');
  const [antragstypFilter, setAntragstypFilter] = useState<KategorieLabel>('Alle');
  const [sortKey, setSortKey] = useState<string | null>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadColumnWidths());

  const handleColumnWidthChange = (key: string, width: number): void => {
    const clamped = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
    setColumnWidths(prev => {
      const next = { ...prev, [key]: clamped };
      try { localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // KI-Analyse ERSETZT die Suchtreffer nicht — sie legt nur eine Begründung
  // (per `id`) über die bestehenden Treffer.
  const dataSource = useMemo<UnifiedSearchResult[]>(
    () => begruendungById
      ? searchResults.map(r => (r.id in begruendungById ? { ...r, begruendung: begruendungById[r.id] } : r))
      : searchResults,
    [searchResults, begruendungById],
  );

  const filterChips = useMemo(() => {
    const pillCounts = countResultsByType(dataSource);
    const base: Array<{ id: FilterId; label: string; count: number }> = [
      { id: '', label: 'Alle', count: dataSource.length },
      { id: 'antrag', label: 'Foerderantraege', count: pillCounts.antraege },
      { id: 'dokument', label: 'Dokumente', count: pillCounts.dokumente },
    ];
    return base;
  }, [dataSource]);

  const pillFiltered = useMemo(
    () => dataSource.filter(r => matchesPillFilter(r, typeFilter)),
    [dataSource, typeFilter],
  );

  // Antragstyp ist ein Foerderantrag-Konzept (vb_phase → FuE/DS/DL/NW). Counts
  // ueber die gesamte Treffer-Liste (stabil). Sichtbar/aktiv nur fuer die
  // Antrag-Pills ('' = Alle, 'antrag').
  const antragstypItems = useMemo(() => getSucheAntragstypItems(dataSource), [dataSource]);
  const antragstypApplicable = typeFilter === '' || typeFilter === 'antrag';
  const antragstypFiltered = useMemo(() => {
    if (antragstypFilter === 'Alle' || !antragstypApplicable) return pillFiltered;
    return pillFiltered.filter(r => matchesSucheAntragstyp(r, antragstypFilter));
  }, [pillFiltered, antragstypFilter, antragstypApplicable]);

  const allColumns = SEARCH_COLUMNS;

  // Per-Result-Spalten-Cache fuer Filter-Werte (WeakMap → GC mit den Results).
  const filterValueCacheRef = useRef<WeakMap<UnifiedSearchResult, Map<string, string>>>(new WeakMap());

  // Nimmt bewusst die BREITERE `SortableColumn`: so passt die Funktion in den
  // `FilterWertVon`-Vertrag der geteilten Facetten-Rechnung. Alle Spalten hier
  // stammen aus `SEARCH_COLUMNS`; eine Spalte ohne `filterType` fiele in
  // `getColumnFilterValue` ohnehin auf den Accessor zurueck.
  const cachedFilterValue = (
    spalte: SortableColumn<UnifiedSearchResult>, r: UnifiedSearchResult,
  ): string => {
    const col = spalte as SearchColumn;
    const cache = filterValueCacheRef.current;
    let perResult = cache.get(r);
    if (!perResult) {
      perResult = new Map<string, string>();
      cache.set(r, perResult);
    }
    let v = perResult.get(col.key);
    if (v === undefined) {
      v = getColumnFilterValue(col, r);
      perResult.set(col.key, v);
    }
    return v;
  };

  const filterCandidatesByColumn = useMemo<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const col of allColumns) {
      if (!col.filterable) continue;
      const set = new Set<string>();
      for (const r of pillFiltered) {
        const s = cachedFilterValue(col, r);
        if (s) set.add(s);
      }
      out[col.key] = Array.from(set).sort(SUCHE_COLLATOR.compare);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [pillFiltered, allColumns]);

  // Facetten-Zahlen fuer das gerade geoeffnete Spalten-Dropdown. Gerechnet wird
  // gegen `antragstypFiltered` — Pill und Antragstyp bleiben nach dem Anwenden
  // aktiv, also gehoeren sie in die Zusage. Die KANDIDATEN kommen weiter aus
  // `pillFiltered` (bewusst breiter): ein Wert kann darum allein wegen des
  // Antragstyp-Filters auf 0 stehen — er bleibt sichtbar, nur ausgegraut.
  //
  // Der Wert-Zugriff MUSS der der Suche sein (`filterType: 'year'|'type'`),
  // sonst zaehlt die Facette andere Werte als der Filter darunter filtert.
  const facettenCache = useMemo(
    () => new Map<string, Map<string, number>>(),
    [antragstypFiltered, columnFilters],
  );
  const filterCountsByColumn = useCallback((key: string): ReadonlyMap<string, number> => {
    let treffer = facettenCache.get(key);
    if (!treffer) {
      const col = allColumns.find(c => c.key === key) ?? getColumnByKey(key);
      treffer = col
        ? zaehleFacette(
          facettenBasis(antragstypFiltered, allColumns, columnFilters, key, cachedFilterValue),
          col,
          cachedFilterValue,
        )
        : new Map<string, number>();
      facettenCache.set(key, treffer);
    }
    return treffer;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [facettenCache, antragstypFiltered, columnFilters, allColumns]);

  const columnFiltered = useMemo(() => {
    const entries = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (entries.length === 0) return antragstypFiltered;
    return antragstypFiltered.filter(r => entries.every(([key, set]) => {
      const col = allColumns.find(c => c.key === key) ?? getColumnByKey(key);
      if (!col) return true;
      return set.has(cachedFilterValue(col, r));
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [antragstypFiltered, columnFilters, allColumns]);

  const sorted = useMemo(() => {
    if (!sortKey) return columnFiltered;
    const col = allColumns.find(c => c.key === sortKey) ?? getColumnByKey(sortKey);
    if (!col) return columnFiltered;
    const copy = [...columnFiltered];
    copy.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
    return copy;
  }, [columnFiltered, sortKey, sortDirection, allColumns]);

  // Treffer, die die KI begründet: Top-N nach Score aus den aktuell angezeigten Treffern.
  const analyseResults = useMemo(
    () => [...sorted].sort((a, b) => b.score - a.score).slice(0, ANALYSE_MAX_RESULTS),
    [sorted],
  );

  const visibleColumnDefs = useMemo<SearchColumn[]>(() => {
    const visibleSet = new Set(visibleColumns);
    const staticCols = SEARCH_COLUMNS.filter(c => visibleSet.has(c.key));
    return analyseActive ? [...staticCols, BEGRUENDUNG_COLUMN] : staticCols;
  }, [visibleColumns, analyseActive]);

  function handleSort(key: string): void {
    if (sortKey !== key) { setSortKey(key); setSortDirection('asc'); return; }
    if (sortDirection === 'asc') { setSortDirection('desc'); return; }
    setSortKey(null);
  }

  function handleColumnFilterChange(key: string, values: Set<string>): void {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (values.size === 0) delete next[key]; else next[key] = values;
      return next;
    });
  }

  return {
    dataSource,
    typeFilter, setTypeFilter,
    antragstypFilter, setAntragstypFilter,
    filterChips, antragstypItems, antragstypApplicable,
    sorted, analyseResults, visibleColumnDefs, filterCandidatesByColumn, filterCountsByColumn,
    sortKey, sortDirection, handleSort,
    columnFilters, handleColumnFilterChange,
    columnWidths, handleColumnWidthChange,
  };
}
