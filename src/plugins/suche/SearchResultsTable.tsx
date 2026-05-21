/**
 * Excel-artige Tabelle fuer die Suchergebnisse.
 *
 * - `table-layout: fixed` + `<colgroup>` fuer stabile Spaltenbreiten.
 * - Pro Zelle wird `column.render(r)` aufgerufen — die Renderer-Map sitzt in
 *   `columns.tsx`, damit die Tabelle selbst nur Layout-/Interaction-Logik
 *   enthaelt.
 * - Klick auf eine Zeile navigiert (nur Antrags-Zeilen — Dokumente haben
 *   keine Detail-Route; das wird mit der spaeteren Chatbot-Phase nachgezogen).
 * - In `React.memo` gewrapped, damit Filter/Sort-State-Aenderungen oberhalb
 *   nicht jede Zeile neu rendern.
 */
import { memo } from 'react';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { SearchColumn } from './columns';
import { SearchTableHeader } from './SearchTableHeader';

export interface SearchResultsTableProps {
  results: UnifiedSearchResult[];
  columns: SearchColumn[];
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  columnFilters: Record<string, Set<string>>;
  onColumnFilterChange: (key: string, values: Set<string>) => void;
  filterCandidatesByColumn: Record<string, string[]>;
  onRowClick: (r: UnifiedSearchResult) => void;
}

function SearchResultsTableInner(props: SearchResultsTableProps): React.ReactElement {
  const {
    results, columns, sortKey, sortDirection, onSort,
    columnFilters, onColumnFilterChange, filterCandidatesByColumn, onRowClick,
  } = props;

  return (
    <div className="w-full overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 'var(--tf-radius)' }}>
      <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
        <colgroup>
          {columns.map(c => (
            <col key={c.key} style={{ width: c.width === 'auto' ? undefined : `${c.width}px` }} />
          ))}
        </colgroup>
        <SearchTableHeader
          columns={columns}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={onSort}
          columnFilters={columnFilters}
          onColumnFilterChange={onColumnFilterChange}
          filterCandidatesByColumn={filterCandidatesByColumn}
        />
        <tbody>
          {results.map((r, rowIdx) => {
            const clickable = r.type === 'antrag';
            return (
              <tr
                key={`${r.type}:${r.id}`}
                className={clickable ? 'cursor-pointer hover:bg-[var(--tf-bg-secondary)]' : 'hover:bg-[var(--tf-bg-secondary)]'}
                onClick={() => clickable && onRowClick(r)}
              >
                {columns.map((c, colIdx) => (
                  <td
                    key={c.key}
                    className="px-3 py-2 align-top text-[12px] text-[var(--tf-text)]"
                    style={{
                      borderBottom: rowIdx < results.length - 1 ? '0.5px solid var(--tf-border)' : undefined,
                      borderRight: colIdx < columns.length - 1 ? '0.5px solid var(--tf-border)' : undefined,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: c.width === 'auto' ? 'normal' : 'nowrap',
                    }}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const SearchResultsTable = memo(SearchResultsTableInner);
