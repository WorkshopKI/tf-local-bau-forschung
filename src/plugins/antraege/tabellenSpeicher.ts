/**
 * Die Speicher-Schlüssel der Fördertabelle — an EINER Stelle.
 *
 * Drei Zustände der Tabelle liegen nicht in einem Store, sondern in Hooks, die
 * ihren Wert beim Mount aus `localStorage` lesen (`useColumnWidths`,
 * `useTotalTableWidth`, `useTableSort`). Bis v4.66 standen ihre Schlüssel als
 * Zeichenketten in `AntraegeTable`; seit ein gemerkter Reiter sie ebenfalls
 * liest und schreibt, gäbe es sie zweimal — und zwei Schreibweisen desselben
 * Schlüssels sind der stille Fall, in dem geschrieben und woanders gelesen wird.
 */

/** Pixelbreiten je Spalte (`useColumnWidths`). */
export const SPEICHER_SPALTENBREITEN = 'teamflow_antraege_table_col_widths';

/** Gepinnte Gesamtbreite + Inhaltsbreiten-Umschalter (`useTotalTableWidth`). */
export const SPEICHER_GESAMTBREITE = 'teamflow_antraege_table_total_width';

/** Klick-Sortierung am Spaltenkopf (`useTableSort`). */
export const SPEICHER_KOPF_SORTIERUNG = 'teamflow_antraege_table_sort';
