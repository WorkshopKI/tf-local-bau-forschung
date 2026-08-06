/**
 * Sortierbare Tabelle mit Spalten-Resize + responsivem Layout.
 *
 * Diese Datei ist der PROPS-VERTRAG der sechs Konsumenten und die Verdrahtung —
 * die Teile liegen daneben:
 *
 * | Datei | Verantwortung |
 * |---|---|
 * | `tableSizing.ts` | Prozent-`<col>`, Wunsch-/Bodenbreite (pur) |
 * | `tableLayout.ts` | die drei Größen-Modi als Stil + Wrapper-Klassen (pur) |
 * | `useColumnResize.ts` | Spalten-Drag: `scale`-Rückrechnung, Live-DOM, Klick-Guard |
 * | `TotalWidthGrip.tsx` | Griff für die Gesamtbreite |
 * | `TableHeadRows.tsx` | Kopfzeile: Sortierung, Filter, Resize-Griffe |
 * | `TableBody.tsx` | Zeilen, Section-Bänder, Empty-State |
 *
 * `table-layout: fixed`; die `<col>` werden IMMER als Prozent ihrer Pixel-Summe
 * gerendert (Begründung + Messung: `tableSizing.ts`). Die bevorzugten Breiten
 * bleiben Pixel im State, nur das Rendern rechnet um. Die drei Größen-Modi
 * (Einpassen / Gepinnt / Scroll) stehen in `tableLayout.ts`.
 *
 * Spalten mit `wrap: false` (explizit) zeigen weiter ellipsis statt umbrechen —
 * fuer kompakte Mono-Felder, Buttons, Indikatoren.
 *
 * Resize ist opt-in: nur wenn `onColumnWidthChange` gesetzt ist, rendert der
 * Header Drag-Handles.
 *
 * Fuer komplexere Tabellen mit Filter-Dropdowns + Virtualisierung (Suche-Plugin)
 * gibt es eine eigene Implementation — `src/plugins/suche/SearchResultsTable.tsx`,
 * das Vorbild fuer die Prozent-Spalten. Diese hier ist die schlanke Variante.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import { computeTableSizing, RESPONSIVE_MIN_WIDTH } from './tableSizing';
import { leiteModus, leiteTabellenStil, wrapperKlassen } from './tableLayout';
import { useAutoColumnWidths } from './messung/useAutoColumnWidths';
import { useColumnResize } from './useColumnResize';
import { TotalWidthGrip } from './TotalWidthGrip';
import { TableHeadRows } from './TableHeadRows';
import { TableBody } from './TableBody';
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
  /** Doppelklick auf den Spaltengriff: gezogene Breite VERWERFEN (nicht die
   *  gemessene festschreiben) — die Spalte folgt danach wieder dem Inhalt. */
  onColumnWidthReset?: (key: string) => void;
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
   *  `onTotalWidthChange` gesetzt ist. `totalWidth` = explizite Pixel-Breite der
   *  GANZEN Tabelle; die Spalten skalieren proportional (CSS `table-layout:
   *  fixed`). `null` = Default: Tabelle füllt den Container (wie
   *  `fitContentWidth`). Backward-kompatibel: Caller ohne diese Props bekommen
   *  keinen Griff. */
  totalWidth?: number | null;
  /** Commit on mouseup (Pixel) bzw. `null` bei Doppelklick (Reset auf Default). */
  onTotalWidthChange?: (width: number | null) => void;
  /** Untergrenze der Gesamtbreite beim Drag. Default 360px. */
  minTotalWidth?: number;
  /** Obergrenze der Gesamtbreite beim Drag. Default 6000px. */
  maxTotalWidth?: number;
  /** Untergrenze beim responsiven Stauchen (Einpass-Modus). Darunter greift der
   *  horizontale Scrollbalken. Default `RESPONSIVE_MIN_WIDTH` (720px). */
  responsiveMinWidth?: number;
  /** Opt-in: Spaltenbreiten aus dem INHALT messen statt aus den gepflegten
   *  `column.width` (siehe `messung/spaltenBreite.ts`). Gezogene Breiten
   *  gewinnen weiterhin. Default `false`.
   *
   *  NUR SINNVOLL IN DEN SCROLL-MODI. Im Einpass-Modus wird die Tabelle ohnehin
   *  auf den Container gestaucht — die Messung ändert dort nicht den Platz,
   *  sondern nur seine Verteilung, und gewichtet dabei jede Spalte nach ihrem
   *  LÄNGSTEN Eintrag. Eine Spalte mit einem einzelnen Ausreißer zieht so Platz
   *  von allen anderen ab. Nachgemessen an der Skill-Tabelle (Container 928px):
   *  abgeschnittene Zellen 74 → 83, auch nachdem die Bauteil-Spalten
   *  ausgenommen waren. Deshalb tragen es nur `AntraegeTable` und `KatalogTab`
   *  (beide `fitContentWidth`); die vier stauchenden Tabellen behalten ihre
   *  gepflegten Breiten. */
  autoColumnWidth?: boolean;
  /** Basis der Messung. Default: `rows`. Wer paginiert, MUSS hier den vollen
   *  Satz übergeben — sonst misst jede nachgeladene Seite neu und die Spalten
   *  springen beim Scrollen. */
  measureRows?: readonly T[];
  /** Diskriminator für die Mess-Signatur, wo `measureRows.length` zwei Zustände
   *  nicht trennt (zwei Filterergebnisse gleicher Länge). O(1) bilden. */
  measureSignature?: string;
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
  onColumnWidthReset,
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
  responsiveMinWidth = RESPONSIVE_MIN_WIDTH,
  autoColumnWidth = false,
  measureRows,
  measureSignature,
}: SortableTableProps<T>): React.ReactElement {
  const resizeEnabled = onColumnWidthChange !== undefined;
  // „Gesamt-Breite"-Griff: `enabled` = Griff wird gerendert; `active` = eine
  // explizite Pixel-Breite ist gepinnt (Tabelle skaliert proportional statt zu
  // füllen).
  const totalWidthEnabled = onTotalWidthChange !== undefined;
  const totalWidthActive = totalWidthEnabled
    && typeof totalWidth === 'number'
    && Number.isFinite(totalWidth);
  const filtersEnabled = onColumnFilterChange !== undefined
    && columnFilters !== undefined
    && filterCandidates !== undefined;
  // Inhaltsabhängige Wunschbreiten. Gemessen wird an `measureRows` (dem vollen
  // Satz), nicht an `rows` (der dargestellten Seite) — sonst rechnete jede
  // nachgeladene Seite neu und die Spalten sprängen beim Scrollen.
  const gemessen = useAutoColumnWidths({
    spalten: columns,
    zeilen: measureRows ?? rows,
    aktiv: autoColumnWidth,
    signatur: measureSignature,
    optionen: { filterAktiv: filtersEnabled },
  });
  // Prozent-Breiten der `<col>` + Wunsch-/Bodenbreite der Tabelle (siehe
  // `tableSizing.ts`). Die Pixel-Summe ist die Wunschbreite, nicht die
  // erzwungene — nur so kann die Tabelle unter ihre Spaltensumme schrumpfen.
  const sizing = useMemo(
    () => computeTableSizing(columns, columnWidths, { responsiveMin: responsiveMinWidth, gemessen }),
    [columns, columnWidths, responsiveMinWidth, gemessen],
  );
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());
  const tableRef = useRef<HTMLTableElement | null>(null);

  const { startResize } = useColumnResize({
    columns,
    columnWidths,
    gemessen,
    sizing,
    responsiveMinWidth,
    fitContentWidth,
    totalWidthActive,
    minColumnWidth,
    onColumnWidthChange,
    colRefs,
    tableRef,
  });

  const modus = leiteModus(totalWidthActive, fitContentWidth);
  const tableStyle = leiteTabellenStil({ modus, sizing, totalWidth });

  // Der Griff steht NEBEN dem Scroll-Container, nicht darin — sonst wandert er
  // mit der Tabelle aus dem Sichtfeld, sobald mehr Spalten da sind als hinein-
  // passen (gemessen: 731px rechts außerhalb). Preis: er folgt dem Cursor beim
  // Ziehen nicht mehr mit; die Drag-Arithmetik (`startWidth + Δx`) bleibt
  // unberührt. Rahmen + Radius trägt deshalb der äußere Wrapper.
  return (
    <div
      className="w-full flex items-stretch rounded-[12px] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className={wrapperKlassen(modus)}>
          <table ref={tableRef} className="text-[12.5px]" style={tableStyle}>
            <colgroup>
              {columns.map(c => {
                // Prozent statt Pixel — sonst ist die Spalten-Summe ein harter
                // Boden für die Tabellenbreite (siehe `tableSizing.ts`).
                const colWidth = sizing.colPercent[c.key];
                return (
                  <col
                    key={c.key}
                    ref={el => {
                      if (el) colRefs.current.set(c.key, el);
                      else colRefs.current.delete(c.key);
                    }}
                    style={{ width: colWidth }}
                  />
                );
              })}
            </colgroup>
            <TableHeadRows
              columns={columns}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={onSort}
              resizeEnabled={resizeEnabled}
              startResize={startResize}
              onColumnWidthReset={onColumnWidthReset}
              filtersEnabled={filtersEnabled}
              columnFilters={columnFilters}
              onColumnFilterChange={onColumnFilterChange}
              filterCandidates={filterCandidates}
            />
            <TableBody
              rows={rows}
              columns={columns}
              rowKey={rowKey}
              onRowClick={onRowClick}
              isRowSelected={isRowSelected}
              emptyContent={emptyContent}
              sectionKeyOf={sectionKeyOf}
              renderSectionHeader={renderSectionHeader}
            />
          </table>
        </div>
      </div>
      {onTotalWidthChange !== undefined ? (
        <TotalWidthGrip
          onTotalWidthChange={onTotalWidthChange}
          minTotalWidth={minTotalWidth}
          maxTotalWidth={maxTotalWidth}
          tableRef={tableRef}
        />
      ) : null}
    </div>
  );
}
