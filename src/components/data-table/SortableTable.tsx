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
import { Fragment, useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { SortIcon } from './SortIcon';
import { ColumnFilterDropdown } from './ColumnFilterDropdown';
import type { SortDirection, SortableColumn } from './types';

const DEFAULT_MIN_COLUMN_WIDTH = 60;
/** Fallback-Breite für Spalten ohne explizite `width`, wenn `fitContentWidth`
 *  aktiv ist (die Pixel-Summe braucht für jede Spalte einen Wert). */
const DEFAULT_FIT_WIDTH = 120;
/** Breite des „Gesamt-Breite"-Griffs (px). Muss mit der `w-[12px]`-Klasse des
 *  Griff-Elements übereinstimmen — im Default-Füll-Modus lässt die Tabelle per
 *  `calc(100% - Npx)` genau diesen Platz frei, sonst entstünde ein Phantom-Scroll. */
const TOTAL_GRIP_WIDTH = 12;

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
  /** Optional: markiert eine Zeile als selektiert (Soft-Grey-Background). Backward-
   *  kompatibel — Caller ohne dieses Prop bekommen keine Selektions-Hervorhebung. */
  isRowSelected?: (row: T) => boolean;
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
  /** Optionale Section-Header: liefert den Section-Key pro Zeile. Die Rows
   *  MÜSSEN bereits nach Section gruppiert (kontiguierlich) übergeben werden —
   *  beim Wechsel des Keys (inkl. erster Zeile) wird eine volle-Breite-Header-
   *  Zeile eingeschoben. Nur wirksam zusammen mit `renderSectionHeader`. */
  sectionKeyOf?: (row: T) => string;
  /** Rendert den Inhalt der Section-Header-Zeile (Band) für einen Section-Key
   *  + die Zeilen-Anzahl der Section. */
  renderSectionHeader?: (sectionKey: string, count: number) => ReactNode;
  /** Horizontale Responsive-Variante (wie `SearchResultsTable`): die Tabelle
   *  nimmt die **Summe der Spaltenbreiten** als Pixel-Breite an (statt
   *  `width:100%`) und scrollt horizontal, sobald mehr/breitere Spalten
   *  hinzukommen — statt die Nachbar-Spalten zu stauchen. `minWidth:100%` füllt
   *  weiterhin den Container, wenn die Summe schmaler als der Container ist.
   *  Default `false` = bisheriges fill-Verhalten (alle Spalten teilen sich 100 %). */
  fitContentWidth?: boolean;
  /** Opt-in „Gesamt-Breite"-Griff am rechten Tabellenrand. Aktiv nur wenn
   *  `onTotalWidthChange` gesetzt ist (dann rendert der rechte Rand einen
   *  breiteren Griff). `totalWidth` = explizite Pixel-Breite der GANZEN Tabelle;
   *  die Spalten skalieren proportional (CSS `table-layout: fixed`). `null` =
   *  Default: Tabelle füllt den Container (wie `fitContentWidth`). Backward-
   *  kompatibel: Caller ohne diese Props bekommen keinen Griff. */
  totalWidth?: number | null;
  /** Commit on mouseup (Pixel) bzw. `null` bei Doppelklick (Reset auf Default). */
  onTotalWidthChange?: (width: number | null) => void;
  /** Untergrenze der Gesamtbreite beim Drag. Default 360px. */
  minTotalWidth?: number;
  /** Obergrenze der Gesamtbreite beim Drag. Default 6000px. */
  maxTotalWidth?: number;
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
  isRowSelected,
  emptyContent,
  columnWidths,
  onColumnWidthChange,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  columnFilters,
  onColumnFilterChange,
  filterCandidates,
  sectionKeyOf,
  renderSectionHeader,
  fitContentWidth = false,
  totalWidth = null,
  onTotalWidthChange,
  minTotalWidth = 360,
  maxTotalWidth = 6000,
}: SortableTableProps<T>): React.ReactElement {
  const resizeEnabled = onColumnWidthChange !== undefined;
  // „Gesamt-Breite"-Griff: `enabled` = Griff wird gerendert; `active` = eine
  // explizite Pixel-Breite ist gepinnt (Tabelle skaliert proportional statt zu
  // füllen).
  const totalWidthEnabled = onTotalWidthChange !== undefined;
  const totalWidthActive = totalWidthEnabled
    && typeof totalWidth === 'number'
    && Number.isFinite(totalWidth);
  // Resizbare Tabellen rendern content-width (wie `SearchResultsTable`): die
  // Tabelle ist so breit wie die Summe der Spaltenbreiten. Sonst streckt
  // `width:100%` die Spalten proportional, `th.offsetWidth` > `<col>`-Breite,
  // und der Resize-Seed überschätzt → Sprung beim Greifen (Handle driftet).
  // Proportional-Skalierung des Gesamt-Griffs braucht Pixel-Weights je Spalte
  // (die `<col>`-Breiten wirken als Verteilungs-Gewichte) → content-width impliziert.
  const contentWidth = fitContentWidth || resizeEnabled || totalWidthEnabled;
  // Pixel-Gesamtbreite (Summe der effektiven Spaltenbreiten) für den
  // content-width-Modus. Spalten ohne explizite Breite zählen mit
  // `DEFAULT_FIT_WIDTH`.
  const totalFitWidth = contentWidth
    ? columns.reduce((s, c) => s + (effectiveWidth(c, columnWidths) ?? DEFAULT_FIT_WIDTH), 0)
    : 0;
  const filtersEnabled = onColumnFilterChange !== undefined
    && columnFilters !== undefined
    && filterCandidates !== undefined;
  const sectionsEnabled = sectionKeyOf !== undefined && renderSectionHeader !== undefined;
  // Section-Counts einmal vorab zählen (Rows sind kontiguierlich gruppiert).
  const sectionCounts = useMemo(() => {
    if (!sectionKeyOf) return null;
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = sectionKeyOf(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [rows, sectionKeyOf]);
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());
  const tableRef = useRef<HTMLTableElement | null>(null);
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
        // Bei gepinnter Gesamtbreite (Griff aktiv) NICHT die Tabelle mitwachsen
        // lassen — sie bleibt auf `totalWidth`, `table-layout:fixed` verteilt die
        // geänderten `<col>`-Gewichte proportional darin (Spalte breiter = mehr
        // Anteil, Nachbarn geben ab). Sonst (Default/content-width) wächst die
        // Tabelle mit der Spalte + scrollt.
        if (totalWidthActive) return;
        // Tabelle mit der Spalte mitwachsen lassen (content-width): sonst
        // staucht `table-layout:fixed` bei fixer Tabellenbreite die Nachbar-
        // spalten, statt horizontal zu scrollen. Summe aus den aktuellen
        // `<col>`-Inline-Styles (Fallback: effektive Breite aus den Props).
        const table = tableRef.current;
        if (table) {
          let sum = 0;
          for (const c of columns) {
            const ref = colRefs.current.get(c.key);
            const px = ref ? parseFloat(ref.style.width) : NaN;
            sum += Number.isFinite(px) ? px : (effectiveWidth(c, columnWidths) ?? DEFAULT_FIT_WIDTH);
          }
          table.style.width = `${sum}px`;
        }
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
    [resizeEnabled, minColumnWidth, onColumnWidthChange, columns, columnWidths, totalWidthActive],
  );

  // Gesamt-Breite-Griff: pinnt die Tabelle live auf eine explizite Pixelbreite;
  // `table-layout:fixed` skaliert alle Spalten proportional mit. Seed aus der
  // aktuell gerenderten Tabellenbreite (`offsetWidth`) → kein Sprung beim
  // Greifen, egal ob vorher Default (füllt Container) oder schon gepinnt.
  const startTotalResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>): void => {
      if (onTotalWidthChange === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      const table = tableRef.current;
      const startWidth = table ? table.offsetWidth : minTotalWidth;
      const startX = e.clientX;
      let latestWidth = startWidth;
      // Sofort auf explizite Breite umstellen (auch aus dem Default-Füll-Modus):
      // minWidth:100% entfernen, sonst kann die Tabelle nicht unter die
      // Container-Breite schrumpfen.
      if (table) {
        table.style.minWidth = '0px';
        table.style.width = `${startWidth}px`;
      }
      function onMove(ev: MouseEvent): void {
        const next = Math.min(maxTotalWidth, Math.max(minTotalWidth, startWidth + (ev.clientX - startX)));
        latestWidth = next;
        if (table) table.style.width = `${next}px`;
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        onTotalWidthChange?.(Math.round(latestWidth));
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onTotalWidthChange, minTotalWidth, maxTotalWidth],
  );

  // Tabellen-Style je Modus:
  // - gepinnt (Griff aktiv): explizite Pixelbreite, flex-none → die Flex-Row
  //   lässt sie über den Container hinaus wachsen (Scroll) bzw. links stehen
  //   (Rest-Weißraum), Spalten skalieren proportional.
  // - Griff aktiv, aber nicht gepinnt (Default-Füllen): wie bisher füllen, aber
  //   per `calc(100% - GRIP)` genau den Griff-Platz frei lassen (kein Phantom-
  //   Scroll), flex-none im Flex-Row-Wrapper.
  // - Griff nicht aktiv (andere Caller): bisheriges Verhalten unverändert.
  const tableStyle: CSSProperties = totalWidthActive
    ? { tableLayout: 'fixed', width: `${totalWidth}px`, flex: '0 0 auto', borderCollapse: 'collapse' }
    : contentWidth
      ? {
          tableLayout: 'fixed',
          width: `${totalFitWidth}px`,
          minWidth: totalWidthEnabled
            ? `calc(100% - ${TOTAL_GRIP_WIDTH}px)`
            : (fitContentWidth ? '100%' : undefined),
          flex: totalWidthEnabled ? '0 0 auto' : undefined,
          borderCollapse: 'collapse',
        }
      : { tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' };

  // Der Griff — immer ein Flex-Sibling am rechten Tabellenrand, damit er dem
  // Cursor beim Ziehen folgt (in beiden Modi). Ziehen = Gesamtbreite;
  // Doppelklick = Reset auf Default (Fensterbreite füllen).
  const renderTotalGrip = (): ReactNode => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Tabellenbreite ändern (Doppelklick: zurücksetzen)"
      title="Ziehen: Tabelle breiter/schmaler · Doppelklick: auf Fensterbreite zurücksetzen"
      onMouseDown={startTotalResize}
      onDoubleClick={() => onTotalWidthChange?.(null)}
      className="shrink-0 h-full w-[12px] flex items-center justify-center cursor-col-resize bg-[var(--tf-bg-secondary)] hover:bg-[var(--tf-border-hover)] z-20"
      style={{ borderLeft: '0.5px solid var(--tf-border)', touchAction: 'none' }}
    >
      <span className="flex flex-col gap-[3px]" aria-hidden="true">
        <span className="w-[3px] h-[3px] rounded-full bg-[var(--tf-text-tertiary)]" />
        <span className="w-[3px] h-[3px] rounded-full bg-[var(--tf-text-tertiary)]" />
        <span className="w-[3px] h-[3px] rounded-full bg-[var(--tf-text-tertiary)]" />
      </span>
    </div>
  );

  const tableEl = (
      <table
        ref={tableRef}
        className="text-[12.5px]"
        style={tableStyle}
      >
        <colgroup>
          {columns.map(c => {
            const w = effectiveWidth(c, columnWidths);
            // Im content-width-Modus braucht jede Spalte eine px-Breite (sonst
            // stimmt die Summe nicht mit der tatsächlichen Tabellenbreite überein).
            const colWidth = contentWidth ? (w ?? DEFAULT_FIT_WIDTH) : w;
            return (
              <col
                key={c.key}
                ref={el => {
                  if (el) colRefs.current.set(c.key, el);
                  else colRefs.current.delete(c.key);
                }}
                style={{ width: colWidth !== undefined ? `${colWidth}px` : undefined }}
              />
            );
          })}
        </colgroup>
        <thead>
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
              return (
                <th
                  key={c.key}
                  className="px-3 py-1.5 align-middle relative"
                  aria-sort={ariaSort}
                  style={
                    resizeEnabled && !isLastCol
                      ? { borderRight: '0.5px solid var(--tf-border)' }
                      : undefined
                  }
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
            const selected = isRowSelected?.(row) ?? false;
            // Section-Band beim Phasen-Wechsel (inkl. erster Zeile) einschieben.
            const sectionKey = sectionsEnabled ? sectionKeyOf!(row) : null;
            const showSection = sectionsEnabled
              && (idx === 0 || sectionKeyOf!(rows[idx - 1]!) !== sectionKey);
            return (
              <Fragment key={rowKey(row)}>
                {showSection ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-3 py-1.5"
                      style={{
                        background: 'var(--tf-bg-secondary)',
                        borderTop: '0.5px solid var(--tf-border)',
                      }}
                    >
                      {renderSectionHeader!(sectionKey!, sectionCounts?.get(sectionKey!) ?? 0)}
                    </td>
                  </tr>
                ) : null}
                <tr
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  className={clickable ? 'cursor-pointer hover:bg-[var(--tf-bg-secondary)]' : undefined}
                  style={{
                    borderTop: '0.5px solid var(--tf-border)',
                    background: selected ? 'var(--tf-bg-secondary)' : undefined,
                  }}
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
              </Fragment>
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
  );

  // Griff deaktiviert (andere Caller): exakt bisheriges Markup.
  if (!totalWidthEnabled) {
    return (
      <div
        className="w-full overflow-x-auto rounded-[12px]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {tableEl}
      </div>
    );
  }

  // Griff aktiv: Tabelle + Griff in einer Flex-Row (`min-w-full` = mind. Container-
  // breit). Gepinnt → Tabelle wächst über den Container hinaus (Scroll) bzw.
  // steht links (Rest-Weißraum). Default → Tabelle füllt via `calc`-minWidth,
  // Griff sitzt bündig am rechten Tabellenrand.
  return (
    <div
      className="w-full overflow-x-auto rounded-[12px]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-stretch w-max min-w-full">
        {tableEl}
        {renderTotalGrip()}
      </div>
    </div>
  );
}
