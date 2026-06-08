import { useMemo } from 'react';
import type { AntragListItem } from '@/core/services/csv/types';
import { SortableTable, useTableSort, useColumnFilters, compareValues, useColumnWidths } from '@/components/data-table';
import { resolveAntragTableColumns } from './tableColumns';
import { useAntraegeColumnsStore } from './useAntraegeColumnsStore';
import { useAntraegeStore } from './store';
import {
  buildVerbundTableRows,
  buildStatusSectionRows,
  type AntragTableRow,
  type TableGroupingMode,
} from './tableGrouping';

interface Props {
  filtered: AntragListItem[];
  visibleRows: number;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  grouping: TableGroupingMode;
  /** „alle"-/Übersichtsmodus → MA-Spalte (tib_kuerz) automatisch einblenden. */
  showMaColumn: boolean;
  onOpenAntrag: (az: string) => void;
  onOpenVerbund: (id: string) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/** Band-Header für `Gruppiert: Status` in der Tabelle — gleiche Optik wie
 *  `StatusSectionHeader` der List-View, aber nicht-kollabierbar (eingebettet
 *  in einer Tabellen-Zeile). */
function StatusBand({ label, count }: { label: string; count: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--tf-text-tertiary)]">
        {label}
      </span>
      <span className="text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">
        {count.toLocaleString('de-DE')}
      </span>
      <div className="flex-1 h-px bg-[var(--tf-border)]" />
    </div>
  );
}

/**
 * Tabellen-Ansicht der Förderanträge ("compact"-View-Mode) — eine echte
 * Header-Tabelle mit konfigurierbaren Spalten (Spalten-Picker im Header) +
 * Klick-auf-Header-Sortierung, gebaut auf der generischen `SortableTable`.
 *
 * Gruppierung (Toolbar-Pille im Compact-Modus):
 * - `none`: flach — `filtered` (bereits gefiltert + Toolbar-sortiert + Verbund-
 *   geclustert). Header-Sort überschreibt die Default-Reihenfolge.
 * - `verbund`: pro Verbund eine Zeile (Multi-TV kollabiert, Solo unverändert).
 * - `status`: jedes TV einzeln, in Status-Bänder gruppiert; Header-Sort wirkt
 *   section-stabil (innerhalb der Bänder).
 *
 * Header-Sort (`useTableSort`) läuft VOR dem Pagination-Slice, damit die
 * Sortierung über die ganze Liste greift, nicht nur die sichtbare Seite.
 */
export function AntraegeTable({
  filtered,
  visibleRows,
  selectedAktenzeichen,
  selectedVerbundId,
  grouping,
  showMaColumn,
  onOpenAntrag,
  onOpenVerbund,
  sentinelRef,
}: Props): React.ReactElement {
  const visibleColumns = useAntraegeColumnsStore(s => s.visibleColumns);
  const verbundById = useAntraegeStore(s => s.verbundById);
  // Persistierte Spalten-Pixelbreiten (Resize via Drag-Handles der SortableTable).
  const { widths, setWidth } = useColumnWidths('teamflow_antraege_table_col_widths', {});
  // Registry-Reihenfolge beibehalten (nicht Toggle-Reihenfolge des Stores).
  // Im „alle"-Modus die MA-Spalte direkt nach der gelockten FKZ-Spalte
  // einblenden (auto-verwaltet, nicht im Spalten-Picker).
  const columns = useMemo(
    () => resolveAntragTableColumns(visibleColumns, showMaColumn),
    [visibleColumns, showMaColumn],
  );

  // VB-Titel ist nicht in `AntragListItem` projiziert (Verbund-Level-Feld) → einmal
  // aus `verbundById` an die Row anhängen. Überlebt alle drei Gruppierungs-Modi
  // (Solo-/Lead-Spread in buildVerbundTableRows, Objekt-Durchreichung in
  // buildStatusSectionRows) und versorgt sowohl die „VB Titel"-Spalte als auch den
  // Spaltenkopf-Filter mit korrekten Werten.
  const enriched = useMemo<AntragTableRow[]>(
    () => filtered.map(a => {
      const t = a.verbund_id ? verbundById.get(a.verbund_id)?.titel : undefined;
      return t ? { ...a, verbund_titel: t } : a;
    }),
    [filtered, verbundById],
  );

  // Spaltenkopf-Filter (Header-Dropdown, wie in der Suche). Kandidaten aus der
  // EINGABE-Liste `enriched` (= Segment-/Sidebar-/Such-gefiltert) → view-scoped
  // und stabil; angewandt VOR der Gruppierung, also pro Einzel-Antrag.
  const { columnFilters, setColumnFilter, filterCandidates, filteredRows } =
    useColumnFilters(enriched, columns);

  // Basis-Zeilen je Gruppierungs-Modus (vor Header-Sort + Slice).
  const { allRows, sectionOf } = useMemo(() => {
    if (grouping === 'verbund') {
      return { allRows: buildVerbundTableRows(filteredRows, verbundById), sectionOf: null };
    }
    if (grouping === 'status') {
      const built = buildStatusSectionRows(filteredRows);
      return { allRows: built.rows, sectionOf: built.sectionOf };
    }
    return { allRows: filteredRows, sectionOf: null };
  }, [grouping, filteredRows, verbundById]);

  const { sortKey, sortDirection, toggleSort, sortedRows } = useTableSort(allRows, columns);

  // Status-Modus: section-stabile Sortierung — Section-Reihenfolge bleibt, nur
  // INNERHALB jeder Section wird nach der aktiven Spalte sortiert. (Der globale
  // `sortedRows` von `useTableSort` würde die Sections zerreißen.)
  const orderedRows = useMemo(() => {
    if (grouping !== 'status' || sectionOf === null) return sortedRows;
    if (!sortKey) return allRows;
    const col = columns.find(c => c.key === sortKey);
    if (!col) return allRows;
    const out: AntragTableRow[] = [];
    let i = 0;
    while (i < allRows.length) {
      const sec = sectionOf(allRows[i]!);
      let j = i;
      while (j < allRows.length && sectionOf(allRows[j]!) === sec) j++;
      const slice = allRows.slice(i, j);
      slice.sort((a, b) => compareValues(col.accessor(a), col.accessor(b), sortDirection));
      out.push(...slice);
      i = j;
    }
    return out;
  }, [grouping, sectionOf, sortedRows, allRows, columns, sortKey, sortDirection]);

  const rows = useMemo(() => orderedRows.slice(0, visibleRows), [orderedRows, visibleRows]);
  const hasMore = visibleRows < orderedRows.length;

  const sectionProps = grouping === 'status' && sectionOf !== null
    ? {
        sectionKeyOf: (r: AntragTableRow) => sectionOf(r) as string,
        renderSectionHeader: (key: string, count: number) => <StatusBand label={key} count={count} />,
      }
    : {};

  return (
    <div className="flex flex-col">
      <SortableTable<AntragTableRow>
        rows={rows}
        columns={columns}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        rowKey={r => r.aktenzeichen}
        onRowClick={r => (r._verbund ? onOpenVerbund(r._verbund.verbundId) : onOpenAntrag(r.aktenzeichen))}
        isRowSelected={r =>
          r._verbund ? r._verbund.verbundId === selectedVerbundId : r.aktenzeichen === selectedAktenzeichen
        }
        emptyContent="Keine Anträge."
        fitContentWidth
        columnWidths={widths}
        onColumnWidthChange={setWidth}
        columnFilters={columnFilters}
        onColumnFilterChange={setColumnFilter}
        filterCandidates={filterCandidates}
        {...sectionProps}
      />
      {hasMore ? (
        <div ref={sentinelRef} className="py-3 text-center text-[11px] text-[var(--tf-text-tertiary)]">
          Lade weitere Einträge …
        </div>
      ) : null}
    </div>
  );
}
