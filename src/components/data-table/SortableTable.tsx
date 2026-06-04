/**
 * Sortierbare Tabelle mit optionalem Spalten-Resize + responsive-Layout.
 *
 * Layout-Modus: `table-layout: fixed` + `width: 100%`. Der Browser
 * verteilt die in `<col width>` gesetzten Pixel-Widths proportional auf
 * die verfuegbare Container-Breite. Folge: bei schmalerem Browser
 * schrumpfen alle Spalten anteilig und Zell-Inhalte mit
 * `whiteSpace: normal` (Default) brechen um statt weggekuerzt zu werden.
 *
 * Spalten mit `wrap: false` (explizit) zeigen weiter ellipsis statt
 * umbrechen — fuer kompakte Mono-Felder, Buttons, Indikatoren.
 *
 * Resize ist opt-in: nur wenn `onColumnWidthChange` gesetzt ist, rendert
 * der Header Drag-Handles. Die Live-Mutation laeuft direkt am DOM
 * (`<col ref>.style.width`), kein React-Re-Render pro Maus-Frame. Erst
 * Mouseup commitet den finalen Wert via `onColumnWidthChange` (das in
 * `useColumnWidths` State + localStorage schreibt).
 *
 * Fuer komplexere Tabellen mit Filter-Dropdowns + horizontal-scroll
 * (Suche-Plugin) gibt es eine eigene Implementation —
 * `src/plugins/suche/SearchResultsTable.tsx`. Diese hier ist die schlanke
 * Variante.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { SortIcon } from './SortIcon';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import type { SortDirection, SortableColumn } from './types';

const DEFAULT_MIN_COLUMN_WIDTH = 60;

export interface SortableTableProps<T> {
  rows: T[];
  columns: SortableColumn<T>[];
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  /** Stabiler React-Key pro Row. */
  rowKey: (row: T) => string;
  /** Optional: Klick auf eine Zeile (cursor-pointer wird automatisch gesetzt). */
  onRowClick?: (row: T) => void;
  /** Optional: Inhalt fuer den Empty-State (wenn `rows.length === 0`). */
  emptyContent?: ReactNode;
  /** Optional: User-Overrides fuer Spaltenbreiten in Pixel. Wenn gesetzt UND
   *  `onColumnWidthChange` gesetzt, sind Drag-Handles aktiv. */
  columnWidths?: Record<string, number>;
  /** Finaler Commit on mouseup nach einem Resize-Drag. */
  onColumnWidthChange?: (key: string, width: number) => void;
  /** Untergrenze beim Drag. Default 60px. */
  minColumnWidth?: number;
  /** Optionaler Spalten-Filter (Header-Dropdown). Aktiv nur wenn ALLE drei
   *  gesetzt sind UND die Spalte `filterable` ist. Backward-kompatibel:
   *  bestehende Caller ohne diese Props bekommen keine Filter-UI. */
  columnFilters?: Record<string, Set<string>>;
  onColumnFilterChange?: (key: string, values: Set<string>) => void;
  /** Distinct Werte je filterbarer Spalte (z.B. aus `useColumnFilters`). */
  filterCandidates?: Record<string, string[]>;
}

function effectiveWidth<T>(
  c: SortableColumn<T>,
  overrides: Record<string, number> | undefined,
): number | undefined {
  const o = overrides?.[c.key];
  if (typeof o === 'number' && Number.isFinite(o)) return o;
  return c.width;
}

export function SortableTable<T>({
  rows,
  columns,
  sortKey,
  sortDirection,
  onSort,
  rowKey,
  onRowClick,
  emptyContent,
  columnWidths,
  onColumnWidthChange,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  columnFilters,
  onColumnFilterChange,
  filterCandidates,
}: SortableTableProps<T>): React.ReactElement {
  const resizeEnabled = onColumnWidthChange !== undefined;
  const filtersEnabled = onColumnFilterChange !== undefined
    && columnFilters !== undefined
    && filterCandidates !== undefined;
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  const startResize = useCallback(
    (key: string, e: React.MouseEvent<HTMLDivElement>): void => {
      if (!resizeEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      const th = (e.currentTarget.parentElement as HTMLElement | null);
      const startWidth = th ? th.offsetWidth : 100;
      const startX = e.clientX;
      let latestWidth = startWidth;

      function onMove(ev: MouseEvent): void {
        const next = Math.max(minColumnWidth, startWidth + (ev.clientX - startX));
        latestWidth = next;
        const col = colRefs.current.get(key);
        if (col) col.style.width = `${next}px`;
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onColumnWidthChange?.(key, latestWidth);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [resizeEnabled, minColumnWidth, onColumnWidthChange],
  );

  return (
    <div
      className="w-full overflow-x-auto rounded-[12px]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <table
        className="text-[12.5px]"
        style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}
      >
        <colgroup>
          {columns.map(c => {
            const w = effectiveWidth(c, columnWidths);
            return (
              <col
                key={c.key}
                ref={el => {
                  if (el) colRefs.current.set(c.key, el);
                  else colRefs.current.delete(c.key);
                }}
                style={{ width: w !== undefined ? `${w}px` : undefined }}
              />
            );
          })}
        </colgroup>
        <thead>
          <tr
            className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]"
            style={{ background: 'var(--tf-bg-secondary)' }}
          >
            {columns.map(c => {
              const active = sortKey === c.key;
              const ariaSort = active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
              const filterActive = filtersEnabled && (columnFilters?.[c.key]?.size ?? 0) > 0;
              return (
                <th
                  key={c.key}
                  className="px-3 py-1.5 align-middle relative"
                  aria-sort={ariaSort}
                >
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
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Spaltenbreite ${c.label} anpassen`}
                      onMouseDown={e => startResize(c.key, e)}
                      className="absolute right-0 top-0 h-full w-[6px] cursor-col-resize hover:bg-[var(--tf-border-hover)] z-10"
                      style={{ touchAction: 'none' }}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            const clickable = onRowClick !== undefined;
            return (
              <tr
                key={rowKey(row)}
                onClick={clickable ? () => onRowClick(row) : undefined}
                className={clickable ? 'cursor-pointer hover:bg-[var(--tf-bg-secondary)]' : undefined}
                style={{ borderTop: '0.5px solid var(--tf-border)' }}
              >
                {columns.map(c => {
                  // Default: Umbruch. Explizit `wrap: false` → kompakt mit ellipsis.
                  const noWrap = c.wrap === false;
                  return (
                    <td
                      key={c.key}
                      className="px-3 py-1 align-top leading-tight"
                      style={{
                        whiteSpace: noWrap ? 'nowrap' : 'normal',
                        wordBreak: noWrap ? undefined : 'break-word',
                        overflow: 'hidden',
                        textOverflow: noWrap ? 'ellipsis' : undefined,
                        borderBottom: !isLast ? '0.5px solid var(--tf-border)' : undefined,
                      }}
                    >
                      {c.render(row)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center text-[var(--tf-text-tertiary)]"
              >
                {emptyContent ?? 'Keine Eintraege.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
