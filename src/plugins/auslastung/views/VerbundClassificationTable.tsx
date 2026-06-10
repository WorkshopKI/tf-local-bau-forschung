/**
 * Verbund-Klassifizierungs-Tabelle: gruppierte Darstellung mit Verbund-Header
 * (sortierbar + interaktiv) und optionalen eingerückten TV-Sub-Zeilen.
 *
 * - Header-Row pro Verbund: Sort/Filter/Picker-fähige Spalten, Pills toggle
 *   den ganzen Verbund, "Freigeben" wirkt verbund-weit.
 * - TV-Sub-Rows (nur bei Verbund mit > 1 TV): eingerückt, dünner Accent-
 *   Border-Left, TV-spezifische Daten wo verfügbar. Kein eigener Sort.
 *
 * Layout: `<table>` mit `tableLayout: fixed; width: 100%`, `<colgroup>` für
 * Pixel-Widths. Resize via Drag-Handle am rechten Rand jedes Headers
 * (analog SortableTable, dieselbe Live-DOM-Mutation-Logik).
 */
import { Fragment, useCallback, useRef } from 'react';
import { SortIcon, type SortDirection } from '@/components/data-table';
import type { AntragOderSlim } from '@/core/services/csv/types';
import type { VerbundKlassifizierungsView } from '../services/verbund-aggregation';
import type { VerbundColumn } from './verbund-columns';

const DEFAULT_MIN_COLUMN_WIDTH = 60;

export interface VerbundClassificationTableProps {
  rows: VerbundKlassifizierungsView[];
  columns: VerbundColumn[];
  sortKey: string | null;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
  columnWidths?: Record<string, number>;
  onColumnWidthChange?: (key: string, width: number) => void;
  minColumnWidth?: number;
  emptyContent?: React.ReactNode;
  /** Verbund-IDs, deren Header-Zeile kurz mit Freigabe-Flash hervorgehoben wird
   *  (Grace-Period nach „Freigeben", bevor die Zeile aus dem Filter faellt). */
  highlightRowIds?: Set<string>;
}

function effectiveWidth(c: VerbundColumn, overrides: Record<string, number> | undefined): number | undefined {
  const o = overrides?.[c.key];
  if (typeof o === 'number' && Number.isFinite(o)) return o;
  return c.width;
}

export function VerbundClassificationTable({
  rows,
  columns,
  sortKey,
  sortDirection,
  onSort,
  columnWidths,
  onColumnWidthChange,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  emptyContent,
  highlightRowIds,
}: VerbundClassificationTableProps): React.ReactElement {
  const resizeEnabled = onColumnWidthChange !== undefined;
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());

  const startResize = useCallback(
    (key: string, e: React.MouseEvent<HTMLDivElement>): void => {
      if (!resizeEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      const th = e.currentTarget.parentElement as HTMLElement | null;
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
              return (
                <th
                  key={c.key}
                  className="px-3 py-1.5 align-middle relative"
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
          {rows.map(view => (
            <Fragment key={view.verbundId}>
              <VerbundHeaderRow
                view={view}
                columns={columns}
                highlight={highlightRowIds?.has(view.verbundId) ?? false}
              />
              {!view.isSolo && view.tvs.map(tv => (
                <TVSubRow
                  key={`${view.verbundId}::${tv.aktenzeichen}`}
                  tv={tv}
                  parent={view}
                  columns={columns}
                />
              ))}
            </Fragment>
          ))}
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

interface VerbundHeaderRowProps {
  view: VerbundKlassifizierungsView;
  columns: VerbundColumn[];
  highlight?: boolean;
}

function VerbundHeaderRow({ view, columns, highlight = false }: VerbundHeaderRowProps): React.ReactElement {
  return (
    <tr
      className={highlight ? 'animate-[freigabe-flash_1400ms_ease-out]' : undefined}
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
    >
      {columns.map((c, idx) => {
        const noWrap = c.wrap === false;
        const isFirst = idx === 0;
        // Bei Multi-TV bekommt auch der Verbund-Header den gruenen Akzent-
        // Border-Left (analog zu den TV-Sub-Rows) — so spannen Header + Subs
        // einen durchgehenden Strich, der Verbund wird visuell zur Einheit.
        // Padding bleibt Default (px-3) — Sub-Rows haben paddingLeft:20px und
        // sind dadurch sichtbar eingerueckt; der gruene Strich verbindet sie.
        const showAccent = isFirst && !view.isSolo;
        return (
          <td
            key={c.key}
            className="px-3 py-1 align-top leading-tight"
            style={{
              whiteSpace: noWrap ? 'nowrap' : 'normal',
              wordBreak: noWrap ? undefined : 'break-word',
              overflow: 'hidden',
              textOverflow: noWrap ? 'ellipsis' : undefined,
              borderLeft: showAccent ? '3px solid var(--tf-primary, #1D9E75)' : undefined,
            }}
          >
            {c.render(view)}
          </td>
        );
      })}
    </tr>
  );
}

interface TVSubRowProps {
  tv: AntragOderSlim;
  parent: VerbundKlassifizierungsView;
  columns: VerbundColumn[];
}

function TVSubRow({ tv, parent, columns }: TVSubRowProps): React.ReactElement {
  return (
    <tr style={{ background: 'var(--tf-bg-secondary)' }}>
      {columns.map((c, idx) => {
        const noWrap = c.wrap === false;
        const isFirst = idx === 0;
        return (
          <td
            key={c.key}
            className="px-3 py-0.5 align-top leading-tight"
            style={{
              whiteSpace: noWrap ? 'nowrap' : 'normal',
              wordBreak: noWrap ? undefined : 'break-word',
              overflow: 'hidden',
              textOverflow: noWrap ? 'ellipsis' : undefined,
              // Linker Akzent-Border zur visuellen Verbund-Klammerung
              borderLeft: isFirst ? '3px solid var(--tf-primary, #1D9E75)' : undefined,
              paddingLeft: isFirst ? '20px' : undefined,
            }}
          >
            {c.renderTV ? c.renderTV(tv, parent) : null}
          </td>
        );
      })}
    </tr>
  );
}
