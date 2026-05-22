/**
 * Schlanke sortierbare Tabelle ohne Resize/Filter/Virtualisierung.
 *
 * Geeignet fuer Listen mit < ~500 Zeilen. Komplexere Such-Tabellen mit
 * Pro-Spalte-Filtern, Live-Resize und IntersectionObserver-Pagination
 * leben weiterhin im Suche-Plugin (`SearchResultsTable`).
 *
 * Optik: gleiche CSS-Tokens wie die Suche-Tabelle (--tf-border,
 * --tf-bg-secondary, etc.), damit die UX konsistent wirkt.
 */
import { type ReactNode } from 'react';
import { SortIcon } from './SortIcon';
import type { SortDirection, SortableColumn } from './types';

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
}: SortableTableProps<T>): React.ReactElement {
  return (
    <div
      className="rounded-[12px] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr
            className="text-left text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]"
            style={{ background: 'var(--tf-bg-secondary)' }}
          >
            {columns.map(c => {
              const active = sortKey === c.key;
              const ariaSort = active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
              return (
                <th
                  key={c.key}
                  className="px-3 py-2 align-middle"
                  style={{ width: c.width ? `${c.width}px` : undefined }}
                  aria-sort={ariaSort}
                >
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
                {columns.map(c => (
                  <td
                    key={c.key}
                    className="px-3 py-2 align-top"
                    style={{
                      whiteSpace: c.wrap ? 'normal' : undefined,
                      borderBottom: !isLast ? '0.5px solid var(--tf-border)' : undefined,
                    }}
                  >
                    {c.render(row)}
                  </td>
                ))}
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
