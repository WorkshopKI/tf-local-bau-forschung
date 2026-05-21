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
 * - Virtualisierung via IntersectionObserver-Pagination (Pattern analog zu
 *   `AntraegeMain.tsx`): Es werden initial `ROW_PAGE` Zeilen gerendert; ein
 *   Sentinel-`<tr>` am Listenende triggert beim Scrollen das Nachladen
 *   weiterer Pages. Spart bei 500+ Treffern den initial DOM-Blowup.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { SearchColumn } from './columns';
import { SearchTableHeader } from './SearchTableHeader';

const ROW_PAGE = 80;
const OVERSCAN_PX = 600;

export interface SearchResultsTableProps {
  results: UnifiedSearchResult[];
  columns: SearchColumn[];
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  columnFilters: Record<string, Set<string>>;
  onColumnFilterChange: (key: string, values: Set<string>) => void;
  filterCandidatesByColumn: Record<string, string[]>;
  /** User-Override fuer Spaltenbreiten (per Drag-Handle gesetzt). Falls leer →
   *  Default-Width aus `SearchColumn.width`. */
  columnWidths: Record<string, number>;
  onColumnWidthChange: (key: string, width: number) => void;
  onRowClick: (r: UnifiedSearchResult) => void;
}

function SearchResultsTableInner(props: SearchResultsTableProps): React.ReactElement {
  const {
    results, columns, sortKey, sortDirection, onSort,
    columnFilters, onColumnFilterChange, filterCandidatesByColumn,
    columnWidths, onColumnWidthChange, onRowClick,
  } = props;

  const [visibleCount, setVisibleCount] = useState(ROW_PAGE);
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);

  // Reset bei jeder neuen Ergebnis-Liste (neue Query, neuer Filter, neuer Sort).
  useEffect(() => {
    setVisibleCount(ROW_PAGE);
  }, [results]);

  // IntersectionObserver auf das Sentinel-Row. Re-Setup wenn entweder die
  // Result-Liste neu ist oder wir bereits mehr Zeilen sichtbar haben.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= results.length) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(v => Math.min(v + ROW_PAGE, results.length));
        }
      },
      { rootMargin: `${OVERSCAN_PX}px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [results.length, visibleCount]);

  function resolveWidth(c: SearchColumn): string | undefined {
    const override = columnWidths[c.key];
    if (typeof override === 'number') return `${override}px`;
    return c.width === 'auto' ? undefined : `${c.width}px`;
  }

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div className="w-full overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 'var(--tf-radius)' }}>
      <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
        <colgroup>
          {columns.map(c => (
            <col key={c.key} style={{ width: resolveWidth(c) }} />
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
          onColumnWidthChange={onColumnWidthChange}
        />
        <tbody>
          {visibleResults.map((r, rowIdx) => {
            const clickable = r.type === 'antrag';
            const isLastVisible = rowIdx === visibleResults.length - 1;
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
                      borderBottom: !isLastVisible || hasMore ? '0.5px solid var(--tf-border)' : undefined,
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
          {hasMore && (
            <tr ref={sentinelRef} aria-hidden>
              <td colSpan={columns.length} style={{ height: 1, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const SearchResultsTable = memo(SearchResultsTableInner);
