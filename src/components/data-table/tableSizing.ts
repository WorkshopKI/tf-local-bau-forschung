/**
 * Spaltenbreiten-Rechnung der `SortableTable` — pur, ohne DOM.
 *
 * WARUM PROZENT UND NICHT PIXEL: Bei `table-layout: fixed` ist die genutzte
 * Tabellenbreite das GRÖSSERE aus `width` und der Summe der `<col>`-Breiten
 * (CSS 2.1 §17.5.2.1). Mit Pixel-`<col>` ist diese Summe ein harter Boden — eine
 * kleinere `width` wird schlicht ignoriert, die Tabelle overflowt und scrollt
 * (im Chrome-Layout nachgemessen: Spalten-Summe 1284px, `width: 600px` →
 * Tabelle bleibt 1284px breit). Werden dieselben Spalten als Prozent ihrer
 * Pixel-Summe gerendert, ist die Spaltensumme definitionsgemäß 100 % der
 * Tabellenbreite — kein Boden mehr, die Tabelle staucht proportional.
 *
 * Die BEVORZUGTEN Breiten bleiben Pixel (`SortableColumn.width` +
 * `useColumnWidths`-Overrides); nur das Rendern rechnet in Prozent um. Dasselbe
 * Muster fährt seit längerem `SearchResultsTable` im Suche-Plugin.
 */
import type { SortableColumn } from './types';

/** Fallback-Breite für Spalten ohne explizite `width`. */
export const DEFAULT_COLUMN_WIDTH = 120;

/**
 * Untergrenze, unter die eine Tabelle beim Stauchen nicht schrumpft — darunter
 * greift der horizontale Scrollbalken, damit Zellen lesbar bleiben. Spiegelt
 * `RESPONSIVE_MIN_WIDTH` der Suche-Tabelle.
 */
export const RESPONSIVE_MIN_WIDTH = 720;

export interface TableSizing {
  /** CSS-Breite je Spalten-Key, als Prozent-String (`'17.1340%'`). */
  colPercent: Record<string, string>;
  /** Wunschbreite = Summe der effektiven Pixelbreiten. */
  desiredWidth: number;
  /** Untergrenze beim Stauchen: `min(desiredWidth, responsiveMin)`. Nie größer
   *  als die Wunschbreite — schmale Spaltensets sollen keinen künstlichen
   *  Mindestbedarf bekommen. */
  floorWidth: number;
}

export interface TableSizingOptions {
  /** Untergrenze beim responsiven Stauchen. Default `RESPONSIVE_MIN_WIDTH`. */
  responsiveMin?: number;
  /** Während eines Spalten-Drags: diese Spalte zählt mit `draggedWidth` statt
   *  mit ihrer gespeicherten Breite (Live-Vorschau ohne React-Re-Render). */
  draggedKey?: string;
  draggedWidth?: number;
}

/** Bevorzugte Pixelbreite einer Spalte: User-Override > `column.width` > Default. */
export function effectiveColumnWidth<T>(
  column: SortableColumn<T>,
  overrides: Record<string, number> | undefined,
): number {
  const o = overrides?.[column.key];
  if (typeof o === 'number' && Number.isFinite(o) && o > 0) return o;
  return column.width ?? DEFAULT_COLUMN_WIDTH;
}

export function computeTableSizing<T>(
  columns: SortableColumn<T>[],
  overrides: Record<string, number> | undefined,
  opts: TableSizingOptions = {},
): TableSizing {
  const responsiveMin = opts.responsiveMin ?? RESPONSIVE_MIN_WIDTH;
  const widthOf = (c: SortableColumn<T>): number =>
    c.key === opts.draggedKey && typeof opts.draggedWidth === 'number' && opts.draggedWidth > 0
      ? opts.draggedWidth
      : effectiveColumnWidth(c, overrides);

  const desiredWidth = columns.reduce((sum, c) => sum + widthOf(c), 0);
  const colPercent: Record<string, string> = {};
  // Ohne Spalten (oder bei kaputter Summe) bleibt die Map leer — der Aufrufer
  // rendert dann `<col>` ohne width, wie vor der Prozent-Umstellung.
  if (desiredWidth > 0) {
    for (const c of columns) {
      colPercent[c.key] = `${((widthOf(c) / desiredWidth) * 100).toFixed(4)}%`;
    }
  }
  return { colPercent, desiredWidth, floorWidth: Math.min(desiredWidth, responsiveMin) };
}
