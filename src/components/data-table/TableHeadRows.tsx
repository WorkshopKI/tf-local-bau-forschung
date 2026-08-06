/**
 * Kopfzeile(n) der `SortableTable`: Beschriftung, Sortier-Knopf, Spalten-Filter
 * und der Resize-Griff je Spalte.
 *
 * Der Zustand des Filter-Dropdowns (welche Spalte offen, an welchem Anker) lebt
 * hier — außerhalb des Kopfes braucht ihn niemand.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { SortIcon } from './SortIcon';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import { baueRubrikSpannen } from './rubrikSpannen';
import type { SortDirection, SortableColumn } from './types';

export interface TableHeadRowsProps<T> {
  columns: SortableColumn<T>[];
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  /** Rendert die Drag-Handles. */
  resizeEnabled: boolean;
  startResize: (key: string, e: React.MouseEvent<HTMLDivElement>) => void;
  /** Doppelklick auf den Griff: gezogene Breite verwerfen. Ohne diesen Callback
   *  bleibt der Doppelklick wirkungslos (und der Titel verspricht ihn nicht). */
  onColumnWidthReset?: (key: string) => void;
  /** Nur aktiv, wenn der Verbraucher alle drei Filter-Props durchreicht. */
  filtersEnabled: boolean;
  columnFilters?: Record<string, Set<string>>;
  onColumnFilterChange?: (key: string, values: Set<string>) => void;
  filterCandidates?: Record<string, string[]>;
  /** Erste Spalte beim waagerechten Scrollen stehen lassen. */
  stickyFirstColumn?: boolean;
  /** Zusätzliche erste Kopfzeile, die zusammenhängende Spalten unter ihrer
   *  Rubrik bündelt. */
  showGroupHeader?: boolean;
}

/** Stapelreihenfolge der klebenden Zellen. Der Kopf muss über den Datenzellen
 *  liegen, und in ihm die klebende Spalte über den scrollenden Köpfen — sonst
 *  schiebt sich beim Scrollen ein Spaltenkopf über die stehende Ecke. */
const Z_KOPF_STICKY = 40;
const Z_KOPF = 30;

export function TableHeadRows<T>({
  columns,
  sortKey,
  sortDirection,
  onSort,
  resizeEnabled,
  startResize,
  onColumnWidthReset,
  filtersEnabled,
  columnFilters,
  onColumnFilterChange,
  filterCandidates,
  stickyFirstColumn = false,
  showGroupHeader = false,
}: TableHeadRowsProps<T>): React.ReactElement {
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const spannen = useMemo(
    () => (showGroupHeader ? baueRubrikSpannen(columns) : []),
    [showGroupHeader, columns],
  );

  return (
    <thead>
      {showGroupHeader && (
        <tr
          className="text-left text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)]"
          style={{ background: 'var(--tf-bg-secondary)' }}
        >
          {spannen.map((s, i) => {
            // Die erste Strecke darf nur dann mitkleben, wenn sie GENAU eine
            // Spalte umfasst — sonst zöge sie die halbe Kopfzeile mit.
            const sticky = stickyFirstColumn && i === 0 && s.span === 1;
            return (
              <th
                key={s.startKey}
                colSpan={s.span}
                className={
                  sticky
                    ? 'px-3 pt-1.5 pb-0.5 align-bottom bg-[var(--tf-bg-secondary)]'
                    : 'px-3 pt-1.5 pb-0.5 align-bottom'
                }
                style={{
                  // Trennlinie nur ZWISCHEN Rubriken, nicht nach der letzten.
                  borderRight: i < spannen.length - 1 ? '0.5px solid var(--tf-border)' : undefined,
                  ...(sticky ? { position: 'sticky', left: 0, zIndex: Z_KOPF_STICKY } : null),
                }}
              >
                {/* Namenlose Strecken bleiben leer, statt eine Ersatz-Beschriftung
                    zu erfinden. */}
                <span className="block truncate">{s.name ?? ''}</span>
              </th>
            );
          })}
        </tr>
      )}
      <tr
        className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]"
        style={{ background: 'var(--tf-bg-secondary)' }}
      >
        {columns.map((c, i) => {
          const active = sortKey === c.key;
          const ariaSort = active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
          const filterActive = filtersEnabled && (columnFilters?.[c.key]?.size ?? 0) > 0;
          // Vertikale Trennlinie als Resize-Hinweis: nur wenn Resize aktiv ist
          // (Linie deckt sich pixelgenau mit der Greifzone) und nicht bei der
          // letzten Spalte. Spiegelt das Muster aus SearchTableHeader.
          const isLastCol = i === columns.length - 1;
          const sticky = stickyFirstColumn && i === 0;
          return (
            <th
              key={c.key}
              // Der graue Grund sitzt normalerweise am `<tr>`; eine klebende
              // Zelle braucht ihn selbst, sonst scrollt der Nachbarinhalt
              // sichtbar dahinter durch.
              className={
                sticky
                  ? 'px-3 py-1.5 align-middle relative bg-[var(--tf-bg-secondary)]'
                  : 'px-3 py-1.5 align-middle relative'
              }
              aria-sort={ariaSort}
              style={{
                ...(resizeEnabled && !isLastCol
                  ? { borderRight: '0.5px solid var(--tf-border)' }
                  : null),
                ...(sticky
                  ? { position: 'sticky', left: 0, zIndex: Z_KOPF_STICKY }
                  : stickyFirstColumn
                    ? { position: 'relative', zIndex: Z_KOPF }
                    : null),
              }}
            >
              {/* Kein `min-w-0`/`break-words` hier: eine Überschrift aus
                  EINEM Wort behält als Flex-Element die Breite dieses
                  Wortes und läuft bei zu schmaler Spalte über den Rand.
                  Der naheliegende Umbruch macht es schlimmer — gemessen an
                  der Antrags-Tabelle, deren 72-px-Spalte „TIB" dann mitten
                  im Wort trennte und die Kopfzeile um 16 px wachsen ließ.
                  Die Spaltenbreite ist die richtige Stellschraube; im
                  Status-Katalog gibt der längste Kopf sie vor. */}
              <div className="flex items-center gap-1">
                {c.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSort(c.key)}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--tf-text)]"
                    title={`Nach ${c.label} sortieren`}
                  >
                    <span>{c.label}</span>
                    <SortIcon active={active} direction={sortDirection} />
                  </button>
                ) : (
                  <span>{c.label}</span>
                )}
                {filtersEnabled && c.filterable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      if (openFilterKey === c.key) {
                        setOpenFilterKey(null);
                        setFilterAnchor(null);
                      } else {
                        setFilterAnchor(e.currentTarget);
                        setOpenFilterKey(c.key);
                      }
                    }}
                    className="ml-auto p-0.5 rounded hover:bg-[var(--tf-hover)] cursor-pointer"
                    title={filterActive ? `Filter aktiv (${columnFilters![c.key]!.size})` : 'Filter'}
                    style={filterActive ? { color: 'var(--tf-primary)' } : { color: 'var(--tf-text-secondary)' }}
                  >
                    {filterActive
                      ? <Filter size={12} fill="currentColor" strokeWidth={2} />
                      : <ChevronDown size={13} strokeWidth={2.25} />}
                  </button>
                )}
              </div>
              {filtersEnabled && c.filterable && openFilterKey === c.key && (
                <ColumnFilterDropdown
                  candidates={filterCandidates![c.key] ?? []}
                  selected={columnFilters![c.key] ?? new Set()}
                  onApply={(values) => {
                    onColumnFilterChange!(c.key, values);
                    setOpenFilterKey(null);
                    setFilterAnchor(null);
                  }}
                  onClose={() => { setOpenFilterKey(null); setFilterAnchor(null); }}
                  formatLabel={c.formatFilterLabel}
                  anchorEl={filterAnchor}
                />
              )}
              {resizeEnabled && (
                <ResizeGriff
                  label={c.label}
                  onMouseDown={e => startResize(c.key, e)}
                  onDoubleClick={onColumnWidthReset ? () => onColumnWidthReset(c.key) : undefined}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function ResizeGriff({
  label,
  onMouseDown,
  onDoubleClick,
}: {
  label: string;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
}): ReactNode {
  const titel = onDoubleClick
    ? `Ziehen: Spalte „${label}" breiter/schmaler · Doppelklick: an den Inhalt anpassen`
    : `Ziehen: Spalte „${label}" breiter/schmaler`;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Spaltenbreite ${label} anpassen`}
      title={titel}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
      style={{ touchAction: 'none' }}
    />
  );
}
