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
 *
 * Optionaler `storageKey`: ist er gesetzt, wird der Sort-State (Spalte +
 * Richtung) in localStorage gespiegelt — die Klick-Sortierung überlebt so
 * einen Reload/Seitenwechsel. Ohne `storageKey` bleibt der State rein
 * in-memory (unveraendertes Verhalten für alle Bestands-Aufrufer).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** Persistierten Sort-State lesen; fehlt/kaputt → Defaults. Eine stale Spalte
 *  (Key existiert nicht mehr) ist harmlos: `sortedRows` fällt über den
 *  `columns.find`-Guard auf die unsortierte Reihenfolge zurück. */
function loadPersistedSort(
  storageKey: string | undefined,
  defaultKey: string | null,
  defaultDirection: SortDirection,
): { key: string | null; dir: SortDirection } {
  if (!storageKey) return { key: defaultKey, dir: defaultDirection };
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        const o = parsed as Record<string, unknown>;
        const key = o.key === null || typeof o.key === 'string' ? (o.key as string | null) : defaultKey;
        const dir = o.dir === 'asc' || o.dir === 'desc' ? o.dir : defaultDirection;
        return { key, dir };
      }
    }
  } catch { /* ignore */ }
  return { key: defaultKey, dir: defaultDirection };
}

export function useTableSort<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  defaultKey: string | null = null,
  defaultDirection: SortDirection = 'desc',
  storageKey?: string,
): UseTableSortResult<T> {
  const [sortKey, setSortKey] = useState<string | null>(
    () => loadPersistedSort(storageKey, defaultKey, defaultDirection).key,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    () => loadPersistedSort(storageKey, defaultKey, defaultDirection).dir,
  );

  // Spiegel-Schreiben nur wenn ein storageKey gesetzt ist. Deckt alle
  // toggleSort-Übergänge inkl. Reset auf `null` ab (idempotenter Mount-Write).
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ key: sortKey, dir: sortDirection }));
    } catch { /* ignore */ }
  }, [storageKey, sortKey, sortDirection]);

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
