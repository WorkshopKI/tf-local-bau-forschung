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
 * - Spalten-Resize laeuft als Live-DOM-Mutation (siehe `applyLiveColumnWidth`):
 *   waehrend des Drags wird `<col>.style.width` + `<table>.style.width` direkt
 *   gesetzt, OHNE React-Re-Render aller Zeilen. Erst beim Mouseup wird der
 *   finale Wert in den React-State + localStorage committed.
 * - `<table>.width = min(100%, Summe aller Spaltenbreiten)`: passt der Spalten-
 *   Gesamtwert in den Container, steht die Tabelle auf ihrer Wunschbreite (der
 *   Rest bleibt frei) — Spalten-Resize per Drag wächst die Tabelle bis dort
 *   weiter. Wird der Container schmaler als die Summe (z.B. Assistent-Panel
 *   offen, schmales Fenster), schrumpft die Tabelle responsiv mit und die
 *   Spalten stauchen sich proportional (`table-layout: fixed`), statt sofort
 *   horizontal zu scrollen. Erst unter `RESPONSIVE_MIN_WIDTH` (Floor) greift der
 *   horizontale Scrollbalken, damit die Zellen lesbar bleiben.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import type { SearchColumn } from './columns';
import { SearchTableHeader } from './SearchTableHeader';

const ROW_PAGE = 80;
const OVERSCAN_PX = 600;
/**
 * Untergrenze, unter die die Tabelle beim responsiven Stauchen nicht schrumpft
 * (darunter greift der horizontale Scrollbalken, damit Zellen lesbar bleiben).
 * Nie größer als die tatsächliche Spalten-Summe (schmale Spaltensets bleiben
 * ohne erzwungenen Scroll). Tunable.
 */
const RESPONSIVE_MIN_WIDTH = 720;

function getEffectiveWidth(c: SearchColumn, overrides: Record<string, number>): number {
  const o = overrides[c.key];
  return typeof o === 'number' ? o : c.width;
}

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

  // DOM-Refs fuer Live-Resize ohne React-Re-Render.
  const tableRef = useRef<HTMLTableElement | null>(null);
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());

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

  // Live-Drag-API: waehrend des Drags wird der Wert NICHT in den React-State
  // committed, sondern direkt am DOM gesetzt (<col>.style.width + <table>.
  // style.width). Spart bei 80+ Zeilen × ~10 Spalten den Re-Render pro
  // Mouse-Frame. Beim Mouseup ruft der Header `onColumnWidthChange` auf, was
  // den finalen Wert in State + localStorage schreibt.
  const applyLiveColumnWidth = useCallback((key: string, width: number): void => {
    const col = colRefs.current.get(key);
    if (col) col.style.width = `${width}px`;
    const table = tableRef.current;
    if (!table) return;
    // Gesamt-Breite neu berechnen aus den aktuellen <col>-Inline-Styles.
    let sum = 0;
    for (const c of columns) {
      const ref = colRefs.current.get(c.key);
      if (ref && ref.style.width) {
        const px = parseFloat(ref.style.width);
        if (Number.isFinite(px)) { sum += px; continue; }
      }
      sum += getEffectiveWidth(c, columnWidths);
    }
    table.style.width = `${sum}px`;
  }, [columns, columnWidths]);

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  // Bei jedem Render: Summe der effektiven Spaltenbreiten als Pixel-Wert = die
  // Wunschbreite der Tabelle. `min(100%, …)` lässt sie responsiv mit einem
  // schmaleren Container mitschrumpfen (Spalten stauchen via table-layout:fixed);
  // der Floor `min-width` verhindert unlesbar enge Zellen (dann Scroll).
  const totalWidth = columns.reduce((s, c) => s + getEffectiveWidth(c, columnWidths), 0);
  const floorWidth = Math.min(totalWidth, RESPONSIVE_MIN_WIDTH);

  return (
    <div className="w-full overflow-x-auto" style={{ border: '0.5px solid var(--tf-border)', borderRadius: 'var(--tf-radius)' }}>
      <table ref={tableRef} style={{ tableLayout: 'fixed', width: `min(100%, ${totalWidth}px)`, minWidth: `${floorWidth}px`, borderCollapse: 'collapse' }}>
        <colgroup>
          {columns.map(c => (
            <col
              key={c.key}
              ref={el => {
                if (el) colRefs.current.set(c.key, el);
                else colRefs.current.delete(c.key);
              }}
              style={{ width: `${getEffectiveWidth(c, columnWidths)}px` }}
            />
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
          onColumnWidthDrag={applyLiveColumnWidth}
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
                      whiteSpace: c.wrap ? 'normal' : 'nowrap',
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
