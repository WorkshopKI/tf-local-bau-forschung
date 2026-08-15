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
 * **Zwei Scroll-Zuschnitte.** Normal scrollt dieser Kasten nur waagerecht und
 * wächst senkrecht mit dem Inhalt — wer ihn einbettet, scrollt selbst. Mit
 * `stickyHeader` übernimmt er auch das senkrechte Scrollen; nur so kann der Kopf
 * stehen bleiben (Begründung am Prop). Das ist eine Absprache mit dem
 * Verbraucher, kein Schalter: er muss die Höhe begrenzen und Scroll-Stand,
 * Beobachtungs-Bereich und Fußzeile hier hereinreichen.
 *
 * Fuer komplexere Tabellen mit Filter-Dropdowns + Virtualisierung (Suche-Plugin)
 * gibt es eine eigene Implementation — `src/plugins/suche/SearchResultsTable.tsx`,
 * das Vorbild fuer die Prozent-Spalten. Diese hier ist die schlanke Variante.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { computeTableSizing, FUELLER_KEY, RESPONSIVE_MIN_WIDTH } from './tableSizing';
import { leiteModus, leiteTabellenStil, wrapperKlassen } from './tableLayout';
import { useAutoColumnWidths } from './messung/useAutoColumnWidths';
import { useColumnResize } from './useColumnResize';
import { TotalWidthGrip } from './TotalWidthGrip';
import { TableHeadRows } from './TableHeadRows';
import { TableBody } from './TableBody';
import type { SortDirection, SortableColumn } from './types';

/** Untergrenze einer einzelnen Spalte beim Ziehen. Exportiert, weil Aufrufer
 *  daraus ihren `responsiveMinWidth` bilden (Summe der Mindestbreiten) — mit
 *  einer eigenen 60 daneben liefen die beiden Zahlen irgendwann auseinander. */
export const DEFAULT_MIN_COLUMN_WIDTH = 60;

/**
 * Innenbreite des Scroll-Containers — Grundlage der Überschuss-Verteilung
 * (`verteileUeberschuss` in `tableSizing.ts`) UND Deckel des aufgeklappten
 * Zeilen-Bereichs (`TableBody.portBreite`).
 *
 * Keine Rückkopplung mit der Tabellenbreite: der Container ist `flex-1 min-w-0`,
 * seine Breite hängt am Elternteil, nicht am Inhalt. Ein waagerechter
 * Scrollbalken nimmt Höhe weg, nicht `clientWidth`.
 *
 * Über die HÖHE gäbe es einen: ein wachsender Ausklappbereich könnte im
 * stehenden Modus einen senkrechten Balken hervorrufen, der `clientWidth`
 * verengt, was den Bereich schmaler und damit höher machte. Genau dagegen steht
 * `scrollbarGutter: 'stable'` weiter unten — es darf deshalb nicht weg.
 *
 * `undefined` heißt hier „noch nicht gemessen"; die Bedeutung „nicht anwendbar"
 * (Einpass-/gepinnter Modus) entsteht erst beim Aufrufer, der die Zahl für die
 * Verteilung mode-abhängig weiterreicht.
 */
function useContainerBreite(
  ref: React.RefObject<HTMLDivElement | null>,
  aktiv: boolean,
): number | undefined {
  const [breite, setBreite] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!aktiv || !el) { setBreite(undefined); return; }
    // Gerundet: `clientWidth` liefert zwar ganze Pixel, aber der Rueckweg ueber
    // Layout-Aenderungen tut es nicht immer — ein Sub-Pixel-Zittern loeste sonst
    // Renderrunden aus, die nichts bewegen.
    const messen = (): void => setBreite(Math.round(el.clientWidth));
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, aktiv]);
  return breite;
}

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
  /** Optional: schmale farbige Kante am Zeilenanfang („Rinne"), z.B. für
   *  Dringlichkeit. Siehe `TableBodyProps.rowAccent`. */
  rowAccent?: (row: T) => string | null;
  /** Senkrechtes Zell-Polster. Default `kompakt` = bisheriges Maß. */
  dichte?: 'kompakt' | 'normal';
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
  /** Trefferzahl je Wert der Spalte (z.B. `useColumnFilters().filterCounts`).
   *  Unabhaengig von den drei oben: ohne sie zeigt das Dropdown wie bisher
   *  keine Zahlen. Gerufen wird nur fuer die gerade geoeffnete Spalte. */
  filterCounts?: (key: string) => ReadonlyMap<string, number>;
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
  /** Commit on mouseup (Pixel) bzw. `null` bei Klick auf den Griff (Pin verwerfen). */
  onTotalWidthChange?: (width: number | null) => void;
  /** Klick auf den Griff, wenn KEINE Breite gepinnt ist: schaltet zwischen
   *  „Spalten teilen sich die Breite" und `fitContentWidth` um. Ohne dieses Prop
   *  verwirft der Klick nur einen Pin und tut sonst nichts. Der Aufrufer hält den
   *  Zustand selbst (`useTotalTableWidth().inhaltsBreite`) und reicht ihn als
   *  `fitContentWidth` wieder herein. */
  onTotalWidthToggle?: () => void;
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
   *  IM EINPASS-MODUS IST DIE MESSUNG DAS GEWICHT, NICHT DER PLATZ. Dort steht
   *  die Tabellenbreite fest (der Container), die Messung entscheidet nur, wie
   *  die Spalten sie untereinander aufteilen — und gewichtet dabei jede Spalte
   *  nach ihrem LÄNGSTEN Eintrag. Das ist eine bewusste Wahl, keine
   *  Selbstverständlichkeit: nachgemessen an der Skill-Tabelle (Container 928px)
   *  stiegen die abgeschnittenen Zellen 74 → 83, weil einzelne Ausreißer Platz
   *  von allen anderen abzogen. Gedeckelt ist der Schaden durch
   *  `MESS_DEFAULTS.maxBreite` (420px).
   *
   *  Deshalb tragen es nur die Tabellen, deren Spaltensatz stark schwankt:
   *  `AntraegeTable` (Einpassen, per Griff auf `fitContentWidth` umschaltbar) und
   *  `KatalogTab` (`fitContentWidth`). Die übrigen stauchenden Tabellen behalten
   *  ihre gepflegten Breiten. */
  autoColumnWidth?: boolean;
  /** Basis der Messung. Default: `rows`. Wer paginiert, MUSS hier den vollen
   *  Satz übergeben — sonst misst jede nachgeladene Seite neu und die Spalten
   *  springen beim Scrollen. */
  measureRows?: readonly T[];
  /** Diskriminator für die Mess-Signatur, wo `measureRows.length` zwei Zustände
   *  nicht trennt (zwei Filterergebnisse gleicher Länge). O(1) bilden. */
  measureSignature?: string;
  /** Opt-in: die erste Spalte bleibt beim waagerechten Scrollen stehen (die
   *  Identitäts-Spalte, damit man beim Blättern nach rechts weiß, welche Zeile
   *  man liest). Bewusst pro Verbraucher: der undurchsichtige Grund der
   *  klebenden Zelle setzt voraus, dass die Tabelle auf der Grundfläche sitzt —
   *  das ist eine Eigenschaft der Umgebung, nicht der Tabelle. Ohne
   *  waagerechten Überlauf ist die Wirkung null, die Kosten (Schatten statt
   *  Rahmen, eigener Stapelkontext) bleiben. Default `false`. */
  stickyFirstColumn?: boolean;
  /** Opt-in: zusätzliche erste Kopfzeile, die zusammenhängende Spalten unter
   *  ihrer `gruppe` bündelt. Lohnt sich erst, wenn die Spaltenreihenfolge nach
   *  Rubrik geordnet ist — sonst zerfällt jede Rubrik in mehrere Strecken und
   *  die Zeile liest sich als Wiederholung. Default `false`. */
  showGroupHeader?: boolean;
  /**
   * Opt-in: die Kopfzeile(n) bleiben beim senkrechten Scrollen stehen.
   *
   * **Das ist kein reiner Stil-Schalter.** Der Kasten wird damit selbst zum
   * senkrechten Scroller — anders geht es nicht: `overflow-x: auto` macht den
   * Scroll-Container per Spec auf BEIDEN Achsen zum Scrollport, er ist also
   * schon heute der nächste scrollende Vorfahr des `<thead>`. Solange er
   * `height: auto` hat und senkrecht nie scrollt, klebt der Kopf an einer Kante,
   * die sich nie bewegt: wirkungslos.
   *
   * Der Verbraucher muss dem Kasten deshalb eine BEGRENZTE Höhe geben (Kette aus
   * `flex-1 min-h-0`) und den Scroll-Stand, den er bisher am eigenen Container
   * hatte, über `scrollContainerRef`/`onScroll` hier hereinreichen. Alles, was
   * unter der Tabelle mitscrollen soll — allen voran ein Pagination-Sentinel —
   * gehört in `footerSlot`; außerhalb stünde es im nicht scrollenden Elternteil
   * und wäre dauerhaft sichtbar.
   */
  stickyHeader?: boolean;
  /** Zugriff auf den Scroll-Container von außen (Scroll-Stand erhalten,
   *  `IntersectionObserver`-Root). Nur mit `stickyHeader` sinnvoll — ohne ihn
   *  scrollt dieser Kasten senkrecht nicht. */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Inhalt UNTER der Tabelle, aber INNERHALB des Scrollers. */
  footerSlot?: ReactNode;
  /**
   * Opt-in: aufklappbarer Bereich unter einer Zeile (`isRowExpanded` +
   * `renderRowDetail`, nur zusammen wirksam).
   *
   * Der Bereich ist eine volle-Breite-`<tr>` im selben `<Fragment>` wie die
   * Datenzeile — dieselbe Mechanik wie die Abschnitts-Bänder. Er geht **nicht**
   * in die Breitenmessung ein (die läuft über `columns × measureRows`), und bei
   * `table-layout: fixed` beeinflusst sein Inhalt die Spaltenbreiten nicht.
   *
   * Wer mehr als eine Zeile gleichzeitig offen haben will, liefert das über
   * `isRowExpanded` — die Tabelle kennt keinen Akkordeon-Zustand.
   */
  isRowExpanded?: (row: T) => boolean;
  renderRowDetail?: (row: T) => ReactNode;
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
  rowAccent,
  dichte,
  emptyContent,
  columnWidths,
  onColumnWidthChange,
  onColumnWidthReset,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  columnFilters,
  onColumnFilterChange,
  filterCandidates,
  filterCounts,
  sectionKeyOf,
  renderSectionHeader,
  fitContentWidth = false,
  totalWidth = null,
  onTotalWidthChange,
  onTotalWidthToggle,
  minTotalWidth = 360,
  maxTotalWidth = 6000,
  responsiveMinWidth = RESPONSIVE_MIN_WIDTH,
  autoColumnWidth = false,
  measureRows,
  measureSignature,
  stickyFirstColumn = false,
  showGroupHeader = false,
  stickyHeader = false,
  scrollContainerRef,
  onScroll,
  footerSlot,
  isRowExpanded,
  renderRowDetail,
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
  // Nur eine WIRKLICH gefilterte Spalte zeigt ihren Chevron dauerhaft und
  // braucht dafür Platz im Kopf; bei allen anderen liegt er außerhalb des
  // Flusses. Sortiert, damit die Mess-Signatur nicht an der Schlüsselreihenfolge
  // hängt.
  const gefilterteKeys = useMemo(
    () => (filtersEnabled
      ? Object.entries(columnFilters!).filter(([, v]) => v.size > 0).map(([k]) => k).sort()
      : []),
    [filtersEnabled, columnFilters],
  );
  const auto = useAutoColumnWidths({
    spalten: columns,
    zeilen: measureRows ?? rows,
    aktiv: autoColumnWidth,
    signatur: measureSignature,
    optionen: { gefilterteKeys },
  });
  const gemessen = auto?.breiten;
  const modus = leiteModus(totalWidthActive, fitContentWidth);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Der Scroller wird an ZWEI Stellen gebraucht: intern für die Breitenmessung,
  // extern für Scroll-Stand und Beobachtungs-Bereich. `useCallback`, damit React
  // die Referenz nicht bei jedem Rendern löst und neu setzt.
  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el;
    if (scrollContainerRef) scrollContainerRef.current = el;
  }, [scrollContainerRef]);
  const detailAktiv = isRowExpanded !== undefined && renderRowDetail !== undefined;
  // Gemessen wird, wo die Zahl gebraucht wird: für die Überschuss-Verteilung
  // (nur Scroll-Modus) ODER als Deckel des aufgeklappten Bereichs. Das Gatter
  // wird erweitert, nicht aufgehoben — sonst haengt jede Tabelle einen
  // `ResizeObserver` an, die ihn gar nicht braucht.
  const portBreite = useContainerBreite(scrollRef, modus === 'scroll' || detailAktiv);
  // Nur im Scroll-Modus gibt es einen Überschuss zu verteilen: im Einpass-Modus
  // ist die Tabelle ohnehin containerbreit, und bei gepinnter Gesamtbreite hat
  // der Nutzer die Breite gesetzt — beides darf die Verteilung nicht anfassen.
  // Die Modus-Abhaengigkeit bleibt ALLEIN hier: fuer `computeTableSizing` heisst
  // `undefined` weiterhin „nicht anwendbar", nicht „noch nicht gemessen".
  const containerBreite = modus === 'scroll' ? portBreite : undefined;
  // Prozent-Breiten der `<col>` + Wunsch-/Bodenbreite der Tabelle (siehe
  // `tableSizing.ts`). Die Pixel-Summe ist die Wunschbreite, nicht die
  // erzwungene — nur so kann die Tabelle unter ihre Spaltensumme schrumpfen.
  const sizing = useMemo(
    () => computeTableSizing(columns, columnWidths, {
      responsiveMin: responsiveMinWidth,
      gemessen,
      wunsch: auto?.wunsch,
      containerBreite,
    }),
    [columns, columnWidths, responsiveMinWidth, gemessen, auto?.wunsch, containerBreite],
  );
  const colRefs = useRef<Map<string, HTMLTableColElement>>(new Map());
  const tableRef = useRef<HTMLTableElement | null>(null);
  // Die Flex-Zeile, die Tabelle + Griff trägt. Der Griff klinkt sie beim Ziehen
  // kurz auf `max-content` aus (Begründung im Dateikopf von `TotalWidthGrip`).
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const { startResize } = useColumnResize({
    columns,
    columnWidths,
    gemessen,
    wunsch: auto?.wunsch,
    containerBreite,
    sizing,
    responsiveMinWidth,
    fitContentWidth,
    totalWidthActive,
    minColumnWidth,
    onColumnWidthChange,
    colRefs,
    tableRef,
  });

  const tableStyle = leiteTabellenStil({ modus, sizing, totalWidth });

  // Der Klick am Griff räumt zuerst auf: eine gepinnte Breite ist die speziellste
  // Ansage, sie geht als erste zurück. Erst ohne Pin schaltet er die Darstellung
  // um. Zwei Klicks statt einem, dafür geht nie eine Einstellung ungefragt
  // verloren.
  const griffKlick = useCallback((): void => {
    if (totalWidthActive) onTotalWidthChange?.(null);
    else onTotalWidthToggle?.();
  }, [totalWidthActive, onTotalWidthChange, onTotalWidthToggle]);
  const griffTitel = totalWidthActive
    ? 'Ziehen: Tabelle breiter/schmaler · Klick: gezogene Breite verwerfen'
    : onTotalWidthToggle
      ? (fitContentWidth
        ? 'Ziehen: Tabelle breiter/schmaler · Klick: Spalten auf die verfügbare Breite verteilen'
        : 'Ziehen: Tabelle breiter/schmaler · Klick: Spalten auf ihre Inhaltsbreite bringen')
      : 'Ziehen: Tabelle breiter/schmaler';

  // Der Griff steht NEBEN dem Scroll-Container, nicht darin — sonst wandert er
  // mit der Tabelle aus dem Sichtfeld, sobald mehr Spalten da sind als hinein-
  // passen (gemessen: 731px rechts außerhalb). Preis: er folgt dem Cursor beim
  // Ziehen nicht mehr mit; die Drag-Arithmetik (`startWidth + Δx`) bleibt
  // unberührt. Rahmen + Radius trägt deshalb der äußere Wrapper.
  return (
    <div
      className={
        'w-full flex items-stretch rounded-[12px] overflow-hidden'
        // Der Kasten nimmt die Resthöhe seines Elternteils, statt mit dem Inhalt
        // zu wachsen — sonst hätte der Scroller keine Kante, an der etwas kleben
        // könnte.
        + (stickyHeader ? ' flex-1 min-h-0' : '')
      }
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div
        ref={setScrollEl}
        onScroll={onScroll}
        className={`flex-1 min-w-0 ${stickyHeader ? 'overflow-auto' : 'overflow-x-auto'}`}
        // Platz für den senkrechten Scrollbalken FEST reservieren. Ohne ihn
        // erscheint der Balken erst, wenn die Zeilen da sind — und verengt damit
        // genau das Element, dessen `clientWidth` die Spaltenbreiten trägt
        // (`useContainerBreite`). Die Folge wäre eine Tabelle, die um die
        // Balkenbreite zu breit ist, bis ein `ResizeObserver`-Durchlauf sie
        // nachzieht. Mit reserviertem Platz stimmt die Messung ab dem ersten
        // Bild. Nur im stehenden Modus — sonst scrollt dieser Kasten senkrecht
        // gar nicht und der Streifen wäre grundlos.
        style={stickyHeader ? { scrollbarGutter: 'stable' } : undefined}
      >
        <div ref={wrapperRef} className={wrapperKlassen(modus)}>
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
              {/* Parkplatz für Platz, den keine Spalte gebrauchen kann. Eine
                  `<col>` OHNE zugehörige Zellen erzeugt trotzdem eine Spalte
                  (im Browser nachgemessen) — deshalb braucht es keine leere
                  Zelle je Zeile. Ohne ihn summierten sich die Prozente auf
                  weniger als 100 % und Chrome bliese alle Spalten wieder
                  proportional auf (ebenfalls nachgemessen: 20/30/20 % werden
                  zu 28,6/42,9/28,6 %). */}
              {sizing.fuellerPercent ? (
                <col
                  ref={el => {
                    if (el) colRefs.current.set(FUELLER_KEY, el);
                    else colRefs.current.delete(FUELLER_KEY);
                  }}
                  style={{ width: sizing.fuellerPercent }}
                />
              ) : null}
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
              filterCounts={filterCounts}
              stickyFirstColumn={stickyFirstColumn}
              showGroupHeader={showGroupHeader}
              stickyHeader={stickyHeader}
            />
            <TableBody
              rows={rows}
              columns={columns}
              rowKey={rowKey}
              onRowClick={onRowClick}
              isRowSelected={isRowSelected}
              rowAccent={rowAccent}
              {...(dichte ? { dichte } : {})}
              emptyContent={emptyContent}
              sectionKeyOf={sectionKeyOf}
              renderSectionHeader={renderSectionHeader}
              stickyFirstColumn={stickyFirstColumn}
              isRowExpanded={isRowExpanded}
              renderRowDetail={renderRowDetail}
              portBreite={portBreite}
            />
          </table>
        </div>
        {/* `sticky left-0` + volle Container-Breite: als gewöhnlicher Block
            säße der Streifen bei waagerecht gescrollter Tabelle links außerhalb
            des Sichtfelds — und ein Pagination-Sentinel dort schneidet den
            Beobachtungs-Bereich nie mehr, das Nachladen bliebe stehen. */}
        {footerSlot ? (
          <div className="sticky left-0 w-full">{footerSlot}</div>
        ) : null}
      </div>
      {onTotalWidthChange !== undefined ? (
        <TotalWidthGrip
          onTotalWidthChange={onTotalWidthChange}
          onKlick={griffKlick}
          titel={griffTitel}
          minTotalWidth={minTotalWidth}
          maxTotalWidth={maxTotalWidth}
          tableRef={tableRef}
          wrapperRef={wrapperRef}
        />
      ) : null}
    </div>
  );
}
