/**
 * Spalten-Filter-State + -Anwendung fuer eine Tabelle (generisch).
 *
 * - Kandidaten je `filterable`-Spalte aus den EINGABE-Rows (vor Spaltenfilter),
 *   damit die Optionen nicht kollabieren, sobald ein Filter aktiv ist.
 * - Anwendung: AND ueber Spalten, OR innerhalb eines Spalten-Sets. Leeres Set
 *   == kein Filter.
 * - Filter-Wert je Zeile: `col.filterAccessor(row)` (Fallback `String(accessor)`).
 *
 * Spiegelt die Suche-Logik (`SuchSeite` filterCandidatesByColumn + columnFiltered)
 * als wiederverwendbaren Hook. Die reine Logik (`deriveFilterCandidates` /
 * `applyColumnFilters`) ist exportiert + testbar ohne React.
 */
import { useCallback, useMemo, useState } from 'react';
import { DATA_TABLE_COLLATOR } from './compareValues';
import type { SortableColumn } from './types';

export interface UseColumnFiltersResult<T> {
  columnFilters: Record<string, Set<string>>;
  setColumnFilter: (key: string, values: Set<string>) => void;
  filterCandidates: Record<string, string[]>;
  filteredRows: T[];
}

/** Filter-Wert einer Zelle (Fallback: stringifizierter Sort-Accessor). */
export function columnFilterValue<T>(col: SortableColumn<T>, row: T): string {
  if (col.filterAccessor) return col.filterAccessor(row);
  const v = col.accessor(row);
  return v === undefined || v === null ? '' : String(v);
}

/** Distinct Werte je filterbarer Spalte, alphabetisch (de-Collation) oder in der
 *  von der Spalte vorgegebenen Reihenfolge (`filterSort`). Pure. */
export function deriveFilterCandidates<T>(
  rows: T[],
  columns: SortableColumn<T>[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const col of columns) {
    if (!col.filterable) continue;
    const set = new Set<string>();
    for (const r of rows) {
      const v = columnFilterValue(col, r);
      if (v) set.add(v);
    }
    out[col.key] = Array.from(set).sort(col.filterSort ?? DATA_TABLE_COLLATOR.compare);
  }
  return out;
}

/** AND ueber Spalten, OR im Set. Leeres/fehlendes Set = kein Filter. Pure. */
export function applyColumnFilters<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  columnFilters: Record<string, Set<string>>,
): T[] {
  const entries = Object.entries(columnFilters).filter(([, s]) => s.size > 0);
  if (entries.length === 0) return rows;
  const colByKey = new Map(columns.map(c => [c.key, c]));
  return rows.filter(r => entries.every(([key, set]) => {
    const col = colByKey.get(key);
    if (!col) return true;
    return set.has(columnFilterValue(col, r));
  }));
}

export function useColumnFilters<T>(
  rows: T[],
  columns: SortableColumn<T>[],
): UseColumnFiltersResult<T> {
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

  const setColumnFilter = useCallback((key: string, values: Set<string>): void => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (values.size === 0) delete next[key]; else next[key] = values;
      return next;
    });
  }, []);

  const filterCandidates = useMemo(() => deriveFilterCandidates(rows, columns), [rows, columns]);
  const filteredRows = useMemo(() => applyColumnFilters(rows, columns, columnFilters), [rows, columns, columnFilters]);

  return { columnFilters, setColumnFilter, filterCandidates, filteredRows };
}
