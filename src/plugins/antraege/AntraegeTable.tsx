import { useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { SortableTable, useTableSort } from '@/components/data-table';
import { ANTRAG_TABLE_COLUMNS } from './tableColumns';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  onOpenAntrag: (az: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Tabellen-Ansicht der Förderanträge ("compact"-View-Mode) — eine echte
 * Header-Tabelle mit konfigurierbaren Spalten (Spalten-Picker im Header) +
 * Klick-auf-Header-Sortierung, gebaut auf der generischen `SortableTable`.
 *
 * Flach (keine Gruppierung) — `filtered` ist bereits gefiltert + Toolbar-
 * sortiert + Verbund-geclustert. Der Header-Sort (`useTableSort`) überschreibt
 * diese Default-Reihenfolge lokal und läuft VOR dem Pagination-Slice, damit die
 * Sortierung über die ganze Liste greift, nicht nur die sichtbare Seite.
 */
export function AntraegeTable({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  onOpenAntrag,
  sentinelRef,
}: Props): React.ReactElement {
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  // Registry-Reihenfolge beibehalten (nicht Toggle-Reihenfolge des Stores).
  const columns = useMemo(() => {
    const set = new Set(visibleColumns);
    return ANTRAG_TABLE_COLUMNS.filter(c => set.has(c.key));
  }, [visibleColumns]);

  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(filtered, columns);
  const rows = useMemo(() => sortedRows.slice(0, visibleRows), [sortedRows, visibleRows]);
  const hasMore = visibleRows < filtered.length;

  return (
    <div className="flex flex-col">
      <SortableTable
        rows={rows}
        columns={columns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={r => r.aktenzeichen}
        onRowClick={r => onOpenAntrag(r.aktenzeichen)}
        isRowSelected={r => r.aktenzeichen === selectedAktenzeichen}
        emptyContent="Keine Anträge."
      />
      {hasMore ? (
        <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
