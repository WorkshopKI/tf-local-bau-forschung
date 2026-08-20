/**
 * XLSX-Export der gefilterten Antrags-Liste — spaltengetrieben.
 *
 * Exportiert GENAU die Spalten, die in der Tabellen-Ansicht sichtbar sind
 * (gleiche Reihenfolge), aufgelöst über `resolveAntragTableColumns` (Single
 * Source mit `AntraegeTable`). Header = Spalten-Label, Zellwert = `exportValue`
 * der Spalte falls gesetzt, sonst `accessor` (Sort-/Anzeige-Wert).
 *
 * Reihenfolge der Zeilen entspricht der `filtered`-Liste aus
 * `useFilteredAntraege` — also der View, die der User sieht (Pipeline-Sort +
 * Verbund-Clustering). Antraege ohne Werte bekommen leere Zellen statt
 * rausgefiltert zu werden, damit Zeilen-Counts zwischen UI und Excel
 * übereinstimmen.
 *
 * VB-Titel-Sonderfall: Verbund-Level-Feld, nicht in `AntragListItem` projiziert.
 * Die Row wird vor dem Spalten-Mapping mit `verbund_titel` angereichert (Kaskade
 * `resolveVbTitel`: Verbund-Objekt → Text-Korpus-`vb` → ''), damit auch unmapped
 * CSV-Spalten exportiert werden. Der Text-Korpus wird nur geladen, wenn die
 * VB-Titel-Spalte sichtbar ist.
 *
 * Reuses `xlsx@0.18.5` (bereits installiert wegen Auslastungs-Modul).
 */
import * as XLSX from 'xlsx';
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SortableColumn } from '@/components/data-table/types';
import { resolveAntragTableColumns } from '../tableColumns';
import type { AntragTableRow } from '../tableGrouping';
import { loadAntraegeTextCorpus } from './search-corpus';

/** Filename-Format: `antraege-export-2026-05-20-23-15.xlsx` — Datum + Uhrzeit
 *  damit Mehrfach-Exports nicht überschreiben und sich chronologisch sortieren. */
function buildFilename(now: Date = new Date()): string {
  const ts = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `antraege-export-${ts}.xlsx`;
}

/**
 * VB-Titel-Lookup mit drei Quellen in Prioritaets-Reihenfolge:
 *
 *  1. Verbund-Object (`Verbund.titel`) — wird vom CSV-Merger gefuellt wenn der
 *     Kurator die Spalte `VB_TITEL` als canonical `verbund_titel` gemappt hat
 *     (Verbund-Level-Feld, geht NICHT auf den Antrag selbst).
 *  2. textMap-Eintrag (Antrag-Record) — wenn die Spalte unmapped oder als
 *     custom auf den Antrag direkt geschrieben wurde (C16-Default ohne
 *     Wizard-Mapping → `a.vb_titel`).
 *  3. Leer-String — kein Titel verfuegbar.
 *
 * Ohne diese Kaskade waere der Export fuer Anträge ohne explizites Wizard-
 * Mapping leer.
 */
function resolveVbTitel(
  antrag: AntragListItem,
  textVb: string,
  verbundById: ReadonlyMap<string, Verbund>,
): string {
  if (antrag.verbund_id) {
    const vb = verbundById.get(antrag.verbund_id);
    if (vb?.titel && vb.titel.length > 0) return vb.titel;
  }
  return textVb;
}

export async function exportFilteredAntraegeXlsx(
  filtered: readonly AntragListItem[],
  idb: IDBStore,
  programmId: string,
  verbundById: ReadonlyMap<string, Verbund>,
  visibleColumnKeys: readonly string[],
  showMaColumn: boolean,
  /** Kuratierte Ordner-Spalten — ohne sie fehlten sie im Export, obwohl sie in
   *  der Ansicht stehen. */
  kategorieSpalten: readonly { kategorieId: string; label: string }[] = [],
  /**
   * Selbst angelegte Spalten, fertig gebaut aus der Ansicht (`AntraegeMain`).
   *
   * Ohne sie fiel jede `frei:`-Spalte still aus dem Export: `resolveAntrag-
   * TableColumns` kennt nur die Registry und die Ordner-Spalten und filtert
   * fremde Keys weg — der Tooltip versprach „mit den Spalten der Ansicht", und
   * die Kopfzeile war eine kürzer als der Bildschirm (v4.121).
   */
  eigeneSpalten: readonly SortableColumn<AntragTableRow>[] = [],
): Promise<{ rowCount: number; filename: string }> {
  // Sichtbare Spalten in Registry-Reihenfolge — identisch zur Tabelle: erst die
  // eingebauten und die Ordner-Spalten, dann die eigenen hinten dran (dieselbe
  // Reihenfolge, die `AntraegeTable.rohSpalten` baut).
  const sichtbar = new Set(visibleColumnKeys);
  const cols = [
    ...resolveAntragTableColumns(visibleColumnKeys, showMaColumn, kategorieSpalten),
    ...eigeneSpalten.filter(c => sichtbar.has(c.key)),
  ];

  // Text-Korpus nur laden, wenn die VB-Titel-Spalte sichtbar ist (der Cursor-
  // Walk über alle Antrags-Records ist teuer; sonst überflüssig). `includeEmpty`
  // hält den Loader für textlose Antraege lückenlos.
  const needsVbText = cols.some(c => c.key === 'verbund_titel');
  const textMap = needsVbText
    ? await loadAntraegeTextCorpus(idb, programmId, { includeEmpty: true })
    : null;

  const header = cols.map(c => c.label);
  const dataRows: (string | number)[][] = filtered.map(a => {
    // VB-Titel an die Row anhängen, damit die Spalten-`accessor` ihn findet
    // (Kaskade inkl. Text-Korpus-Fallback für unmapped CSV-Spalten).
    const vb = needsVbText
      ? resolveVbTitel(a, textMap!.get(a.aktenzeichen)?.vb ?? '', verbundById)
      : '';
    const row: AntragTableRow = vb ? { ...a, verbund_titel: vb } : a;
    return cols.map(c => (c.exportValue ? c.exportValue(row) : c.accessor(row)));
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  // Spaltenbreiten grob aus der Registry-Pixelbreite ableiten (px → Excel-
  // Zeichenbreite ≈ /7), Fallback 18 Zeichen.
  ws['!cols'] = cols.map(c => ({ wch: c.width ? Math.max(8, Math.round(c.width / 7)) : 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Anträge');

  const filename = buildFilename();
  XLSX.writeFile(wb, filename);
  return { rowCount: filtered.length, filename };
}
