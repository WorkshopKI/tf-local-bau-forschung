/**
 * Filter-/Sort-/Spalten-Pipeline der Suche (Konsolidierung 2026-07 aus SuchSeite.tsx
 * extrahiert — die zweite der drei TODO-Verantwortungs-Grenzen). Kapselt den
 * gesamten abgeleiteten Zustand: von den rohen `searchResults` (+ optionaler
 * KI-Begründung) über die Spalten-Filter und die Sortierung bis zur
 * `sorted`-Liste, den sichtbaren Spalten und den Analyse-Kandidaten.
 *
 * Die früheren Treffer-Pillen (Alle/Förderanträge/Dokumente) und der
 * Antragstyp-Umschalter sind mit v4.5 entfallen: beides beantwortet jetzt die
 * FACETTENZEILE über dem Ergebnis, und sie gilt für Liste UND Tabelle. Zwei
 * Filtersysteme für dieselbe Frage nebeneinander wären genau die Drift, gegen
 * die die Layout-Regel steht — die Facetten stehen deshalb VOR diesem Hook, ihre
 * Ergebnisse kommen hier als `searchResults` an.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { facettenBasis, zaehleFacette, type SortableColumn } from '@/components/data-table';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import {
  SEARCH_COLUMNS, BEGRUENDUNG_COLUMN, getColumnByKey, getColumnFilterValue, type SearchColumn,
} from './columns';
import { compareValues, SUCHE_COLLATOR } from './suchseite-utils';

const DEFAULT_SORT_KEY = 'score';
const COLUMN_WIDTHS_KEY = 'teamflow_suche_column_widths';
const MIN_COLUMN_WIDTH = 60;
/** Obergrenze der Treffer, die „Treffer begründen" begründet (Kosten/Tempo).
 *  Exportiert, damit der Knopf-Tooltip dieselbe Zahl nennt, die hier gilt. */
export const ANALYSE_MAX_RESULTS = 50;

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

  // Sortierung und Spaltenfilter bleiben lokal — sie sind Feinarbeit an EINER
  // Trefferliste, nicht an der Suche.
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
      for (const r of dataSource) {
        const s = cachedFilterValue(col, r);
        if (s) set.add(s);
      }
      out[col.key] = Array.from(set).sort(SUCHE_COLLATOR.compare);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [dataSource, allColumns]);

  // Facetten-Zahlen fuer das gerade geoeffnete Spalten-Dropdown.
  //
  // Der Wert-Zugriff MUSS der der Suche sein (`filterType: 'year'|'type'`),
  // sonst zaehlt die Facette andere Werte als der Filter darunter filtert.
  const facettenCache = useMemo(
    () => new Map<string, Map<string, number>>(),
    [dataSource, columnFilters],
  );
  const filterCountsByColumn = useCallback((key: string): ReadonlyMap<string, number> => {
    let treffer = facettenCache.get(key);
    if (!treffer) {
      const col = allColumns.find(c => c.key === key) ?? getColumnByKey(key);
      treffer = col
        ? zaehleFacette(
          facettenBasis(dataSource, allColumns, columnFilters, key, cachedFilterValue),
          col,
          cachedFilterValue,
        )
        : new Map<string, number>();
      facettenCache.set(key, treffer);
    }
    return treffer;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [facettenCache, dataSource, columnFilters, allColumns]);

  const columnFiltered = useMemo(() => {
    const entries = Object.entries(columnFilters).filter(([, set]) => set.size > 0);
    if (entries.length === 0) return dataSource;
    return dataSource.filter(r => entries.every(([key, set]) => {
      const col = allColumns.find(c => c.key === key) ?? getColumnByKey(key);
      if (!col) return true;
      return set.has(cachedFilterValue(col, r));
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cachedFilterValue ist stable per ref
  }, [dataSource, columnFilters, allColumns]);

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
    sorted, analyseResults, visibleColumnDefs, filterCandidatesByColumn, filterCountsByColumn,
    sortKey, sortDirection, handleSort,
    columnFilters, handleColumnFilterChange,
    columnWidths, handleColumnWidthChange,
  };
}
