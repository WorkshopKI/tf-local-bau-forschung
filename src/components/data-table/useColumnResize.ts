/**
 * Spalten-Resize der `SortableTable` — die gefährlichste Interaktion des
 * Bausteins, deshalb eigene Datei.
 *
 * Die Live-Mutation läuft direkt am DOM (`<col ref>.style.width`), kein
 * React-Re-Render pro Maus-Frame. Erst Mouseup committet den finalen Wert.
 *
 * ZWEI Feinheiten, die man beim Nachbauen verliert:
 *
 * 1. **Rückrechnung über `scale`.** Im gestauchten Zustand ist die gerenderte
 *    Spalte schmaler als ihre gespeicherte Wunschbreite. Gezogen wird in
 *    GERENDERTEN Pixeln (der Griff folgt dem Cursor), committet wird
 *    zurückgerechnet — sonst würde jedes Ziehen die Wunschbreite still auf das
 *    gestauchte Maß herabsetzen und die Spalte gegenüber ihren ungezogenen
 *    Nachbarn schrumpfen.
 * 2. **`bewegt`-Guard.** Ohne ihn committet JEDER Mouseup auf dem Griff — auch
 *    einer ohne Mausbewegung. Ein bloßer Klick schriebe dann einen Override, den
 *    es vorher nicht gab (im gestauchten Modus zusätzlich mit `scale`
 *    verrechnet), und ein Doppelklick löste zwei davon aus, BEVOR `dblclick`
 *    feuert. Erst ab `DRAG_SCHWELLE` gilt eine Geste als Ziehen.
 */
import { useCallback } from 'react';
import { computeTableSizing, FUELLER_KEY, type TableSizing } from './tableSizing';
import type { SortableColumn } from './types';

/** Ab dieser Cursor-Verschiebung (px) gilt eine Geste als Ziehen, nicht als Klick. */
export const DRAG_SCHWELLE = 3;

export interface ColumnResizeParams<T> {
  columns: SortableColumn<T>[];
  columnWidths: Record<string, number> | undefined;
  /** Gemessene Inhaltsbreiten — MUSS durchgereicht werden, sonst fallen die
   *  ungezogenen Spalten während des Zugs auf `column.width` zurück. */
  gemessen: Record<string, number> | undefined;
  /** Ungeklemmte Wunschbreiten + Containerbreite — aus demselben Grund Pflicht:
   *  ohne sie fiele die Überschuss-Verteilung mitten im Zug weg und alle Spalten
   *  sprängen einmal auf ihre unverteilte Breite. */
  wunsch: Record<string, number> | undefined;
  containerBreite: number | undefined;
  sizing: TableSizing;
  responsiveMinWidth: number;
  fitContentWidth: boolean;
  /** Bei gepinnter Gesamtbreite bleibt die Tabellenbreite fix; nur die Gewichte verschieben sich. */
  totalWidthActive: boolean;
  minColumnWidth: number;
  onColumnWidthChange?: (key: string, width: number) => void;
  colRefs: { current: Map<string, HTMLTableColElement> };
  tableRef: { current: HTMLTableElement | null };
}

export interface ColumnResizeResult {
  startResize: (key: string, e: React.MouseEvent<HTMLDivElement>) => void;
}

export function useColumnResize<T>(p: ColumnResizeParams<T>): ColumnResizeResult {
  const {
    columns, columnWidths, gemessen, wunsch, containerBreite, sizing, responsiveMinWidth,
    fitContentWidth, totalWidthActive, minColumnWidth, onColumnWidthChange, colRefs, tableRef,
  } = p;
  const resizeEnabled = onColumnWidthChange !== undefined;

  const startResize = useCallback(
    (key: string, e: React.MouseEvent<HTMLDivElement>): void => {
      if (!resizeEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      const th = (e.currentTarget.parentElement as HTMLElement | null);
      const startWidth = th ? th.offsetWidth : 100;
      const startX = e.clientX;
      let latestWidth = startWidth;
      let bewegt = false;
      const renderedWidth = tableRef.current?.offsetWidth ?? sizing.desiredWidth;
      // `min(1, …)`: die Rückrechnung korrigiert nur das STAUCHEN. Ist die
      // Tabelle breiter als die Spaltensumme, liegt das nicht an einer
      // gleichmäßigen Dehnung, sondern daran, dass der Überschuss gezielt an
      // einzelne Spalten ging (`verteileUeberschuss`) — die übrigen rendern
      // dabei 1:1. Ohne den Deckel bekäme ein Zug an einer UNVERTEILTEN Spalte
      // ihre Breite durch den Faktor der Tabelle geteilt (gemessen: 1,4).
      const scale = sizing.desiredWidth > 0
        ? Math.min(1, renderedWidth / sizing.desiredWidth)
        : 1;

      function onMove(ev: MouseEvent): void {
        const dx = ev.clientX - startX;
        // Klick-Schutz: erst jenseits der Schwelle ist es ein Ziehen (s. Dateikopf).
        if (!bewegt) {
          if (Math.abs(dx) < DRAG_SCHWELLE) return;
          bewegt = true;
        }
        const next = Math.max(minColumnWidth, startWidth + dx);
        latestWidth = next;
        // Live-Vorschau: ALLE `<col>` neu als Prozent rechnen (die gezogene
        // Spalte mit ihrer Wunschbreite). Aus den Props gerechnet, nie aus dem
        // DOM — `parseFloat('14%')` läse 14 als Pixel.
        const live = computeTableSizing(columns, columnWidths, {
          responsiveMin: responsiveMinWidth,
          gemessen,
          wunsch,
          containerBreite,
          draggedKey: key,
          draggedWidth: scale > 0 ? next / scale : next,
        });
        for (const c of columns) {
          const col = colRefs.current.get(c.key);
          const pct = live.colPercent[c.key];
          if (col && pct) col.style.width = pct;
        }
        // Der Füller schrumpft, während die gezogene Spalte wächst. Bliebe er
        // stehen, summierten sich die Prozente über 100 % und die Tabelle
        // schöbe die letzte Spalte aus dem Bild.
        const fueller = colRefs.current.get(FUELLER_KEY);
        if (fueller) fueller.style.width = live.fuellerPercent ?? '0%';
        // Bei gepinnter Gesamtbreite bleibt die Tabelle auf `totalWidth` — die
        // geänderten Prozent-Gewichte verteilen sich darin (Spalte breiter =
        // Nachbarn geben ab). Sonst wächst die Wunschbreite mit.
        if (totalWidthActive) return;
        const table = tableRef.current;
        if (table) {
          table.style.width = `${live.desiredWidth}px`;
          if (!fitContentWidth) table.style.minWidth = `${live.floorWidth}px`;
        }
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (!bewegt) return;
        onColumnWidthChange?.(key, Math.round(scale > 0 ? latestWidth / scale : latestWidth));
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [
      resizeEnabled, minColumnWidth, onColumnWidthChange, columns, columnWidths, gemessen,
      wunsch, containerBreite, totalWidthActive, sizing, responsiveMinWidth, fitContentWidth,
      colRefs, tableRef,
    ],
  );

  return { startResize };
}
