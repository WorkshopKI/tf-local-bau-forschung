/**
 * Rubrik-Kopfzeile: zusammenhängende Strecken gleicher `gruppe` über den
 * Spalten. Pur, ohne DOM.
 *
 * Der Renderer sortiert NICHT um. Die Spaltenreihenfolge ist die der
 * übergebenen Liste — bei den Förderanträgen zugleich die Reihenfolge des
 * XLSX-Exports (beide lesen `resolveAntragTableColumns`). Würde hier umsortiert,
 * liefen Tabelle und Export auseinander. Wer eine lesbare Rubrikzeile will,
 * ordnet die Registry — dann ändern sich beide gemeinsam.
 */
import type { SortableColumn } from './types';

export interface RubrikSpanne {
  /** `null` = Spalten ohne `gruppe` (namenlose Strecke). */
  name: string | null;
  /** Anzahl der Spalten, über die sich die Strecke zieht. */
  span: number;
  /** Key der ersten Spalte der Strecke — stabiler React-Key. */
  startKey: string;
}

export function baueRubrikSpannen<T>(
  columns: readonly SortableColumn<T>[],
): RubrikSpanne[] {
  const out: RubrikSpanne[] = [];
  for (const c of columns) {
    const roh = typeof c.gruppe === 'string' ? c.gruppe.trim() : '';
    const name = roh.length > 0 ? roh : null;
    const letzte = out[out.length - 1];
    // Nur ZUSAMMENHÄNGENDE Spalten derselben Rubrik werden gebündelt. Steht eine
    // Rubrik in mehreren Stücken, gibt es mehrere Strecken — das ist kein
    // Fehler, sondern die ehrliche Abbildung der Spaltenreihenfolge.
    if (letzte && letzte.name === name) {
      letzte.span += 1;
      continue;
    }
    out.push({ name, span: 1, startKey: c.key });
  }
  return out;
}
