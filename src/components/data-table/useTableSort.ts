/**
 * Sort-State + sortierte Zeilen fuer eine Tabelle.
 *
 * Sort-Zyklus pro Spalte:
 *  - inaktiv → asc
 *  - asc    → desc
 *  - desc   → inaktiv (Default-Reihenfolge der Daten)
 *
 * Default-Sort wird beim Init gesetzt; danach steuert ausschliesslich
 * `toggleSort(key)` den State. Bei Wechsel der Spalte startet der Zyklus
 * neu bei `asc`.
 */
import { useCallback, useMemo, useState } from 'react';
import { compareValues } from './compareValues';
import type { SortDirection, SortableColumn } from './types';

export interface UseTableSortResult<T> {
  sortKey: string | null;
  sortDirection: SortDirection;
  toggleSort: (key: string) => void;
  /** Frische, sortierte Kopie der Rows. Bei `sortKey === null` werden die
   *  Rows unveraendert zurueckgegeben. */
  sortedRows: T[];
}

export function useTableSort<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  defaultKey: string | null = null,
  defaultDirection: SortDirection = 'desc',
): UseTableSortResult<T> {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const toggleSort = useCallback((key: string): void => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }
    // war desc: zurueck zu null (unsortiert)
    setSortKey(null);
  }, [sortKey, sortDirection]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
    return copy;
  }, [rows, columns, sortKey, sortDirection]);

  return { sortKey, sortDirection, toggleSort, sortedRows };
}
