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
 * - Responsives Stauchen (WICHTIG: Spalten als PROZENT, nicht Pixel):
 *   Bei `table-layout: fixed` ist die genutzte Tabellenbreite das GRÖSSERE aus
 *   `width` und der Summe der `<col>`-Breiten (CSS 2.1 §17.5.2.1). Mit Pixel-
 *   `<col>` ist diese Summe ein harter Boden → `width: min(100%, …)` bliebe
 *   wirkungslos, die Tabelle overflowt sofort (empirisch im Chrome-Layout
 *   verifiziert: 200px-Cols in 900px-Container → Tabelle bleibt 1400px). Deshalb
 *   werden die `<col>` als Prozent ihrer Pixel-Summe (`totalWidth`) gerendert:
 *   dann ist die Spaltensumme = 100 % der Tabellenbreite (kein Pixel-Boden) und
 *   `width: min(100%, totalWidth)` staucht die Spalten proportional mit einem
 *   schmaleren Container (z.B. Assistent-Panel offen). Passt alles → Tabelle auf
 *   Wunschbreite (Rest frei). Erst unter `RESPONSIVE_MIN_WIDTH` (Floor, via
 *   `min-width`) greift der horizontale Scrollbalken, damit Zellen lesbar bleiben.
 *   Die *bevorzugten* Breiten bleiben Pixel im State (`columnWidths`); nur das
 *   Render (und der Live-Drag unten) rechnet in Prozent um.
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
  /** Nur gelesen — `readonly`, damit die Tabelle dieselbe (gefilterte) Menge
   *  entgegennehmen kann wie Liste, Kopfzahl und Export. */
  results: readonly UnifiedSearchResult[];
  columns: SearchColumn[];
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  columnFilters: Record<string, Set<string>>;
  onColumnFilterChange: (key: string, values: Set<string>) => void;
  filterCandidatesByColumn: Record<string, string[]>;
  /** Trefferzahl je Wert der Spalte — gerufen nur fuer das offene Dropdown. */
  filterCountsByColumn?: (key: string) => ReadonlyMap<string, number>;
  /** User-Override fuer Spaltenbreiten (per Drag-Handle gesetzt). Falls leer →
   *  Default-Width aus `SearchColumn.width`. */
  columnWidths: Record<string, number>;
  onColumnWidthChange: (key: string, width: number) => void;
  onRowClick: (r: UnifiedSearchResult) => void;
}

function SearchResultsTableInner(props: SearchResultsTableProps): React.ReactElement {
  const {
    results, columns, sortKey, sortDirection, onSort,
    columnFilters, onColumnFilterChange, filterCandidatesByColumn, filterCountsByColumn,
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
    // Neue Gesamt-Breite = Summe der bevorzugten Pixel-Breiten, mit der gerade
    // gedraggten Spalte auf `width`. Direkt aus `columns`/`columnWidths`
    // gerechnet (NICHT aus dem DOM), damit die Prozent-Umrechnung nicht auf
    // `parseFloat("14%")` hereinfällt. <col> + <table> werden identisch zum
    // committeten Render gesetzt (Prozent-Cols + `min(100%, …)`), damit es beim
    // Ziehen — auch in gestauchtem Zustand — nicht kurz overflowt.
    const newTotal = columns.reduce(
      (s, c) => s + (c.key === key ? width : getEffectiveWidth(c, columnWidths)), 0);
    if (newTotal <= 0) return;
    for (const c of columns) {
      const eff = c.key === key ? width : getEffectiveWidth(c, columnWidths);
      const col = colRefs.current.get(c.key);
      if (col) col.style.width = `${(eff / newTotal) * 100}%`;
    }
    const table = tableRef.current;
    if (table) {
      table.style.width = `min(100%, ${newTotal}px)`;
      table.style.minWidth = `${Math.min(newTotal, RESPONSIVE_MIN_WIDTH)}px`;
    }
  }, [columns, columnWidths]);

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  // Bei jedem Render: Summe der effektiven Spalten-Pixel = Wunschbreite der
  // Tabelle. Die <col> werden als Prozent DIESER Summe gerendert (siehe
  // Dateikopf) — nur so staucht `width: min(100%, …)` die Spalten wirklich
  // (Pixel-<col> würden die Tabelle festnageln). Floor `min-width` verhindert
  // unlesbar enge Zellen (darunter Scroll).
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
              style={{ width: `${(getEffectiveWidth(c, columnWidths) / totalWidth) * 100}%` }}
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
          filterCountsByColumn={filterCountsByColumn}
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
