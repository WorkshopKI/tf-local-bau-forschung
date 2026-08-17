/**
 * XLSX-Export der Katalog-Tabelle — spaltengetrieben.
 *
 * Exportiert genau die Zeilen und Spalten, die in der Ansicht stehen (gleiche
 * Reihenfolge, gleiche Filter, gleiche Sortierung). Zellwert ist `exportValue`
 * der Spalte, sonst `accessor` — dieselbe Aufteilung wie beim Antrags-Export
 * (`services/export-xlsx.ts`), damit ein Sortier-Rang wie `kategorieRang` nicht
 * als nackte Zahl in Excel landet.
 *
 * **Eine Spalte kommt hinzu, die die Ansicht nicht mehr zeigt**: der rohe
 * CSV-Spaltenname. In der Tabelle steht er seit v2.411 nur noch im Tooltip des
 * Feldnamens — im Termin will niemand Zeile für Zeile hovern, um zu belegen, aus
 * welcher Spalte ein Statuswert stammt. Im Export kostet die Spalte nichts.
 */
import * as XLSX from 'xlsx';
import type { SortableColumn } from '@/components/data-table';
import type { KatalogZeile } from './katalogZeilen';

/** Die Spalte, die es nur im Export gibt (siehe Dateikopf). */
const CSV_SPALTE: SortableColumn<KatalogZeile> = {
  key: 'csvSpalte',
  label: 'CSV-Spalte',
  defaultVisible: true,
  sortable: false,
  width: 140,
  accessor: z => z.csvSpalte,
  render: () => null,
};

/** `status-katalog-v12-2026-08-05-14-30.xlsx` — Fassung und Zeitpunkt im Namen,
 *  damit zwei Exporte eines Tages unterscheidbar bleiben. */
function baueDateiname(version: number | null, now: Date = new Date()): string {
  const ts = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `status-katalog${version !== null ? `-v${version}` : ''}-${ts}.xlsx`;
}

/**
 * Dateiname der beiden JSON-Exporte dieser Seite (ganzer Katalog, nur Phasen).
 *
 * `-entwurf` steht im Namen, sobald der Stand auf dem Bildschirm von der
 * gespeicherten Fassung abweicht. Beides gehört zusammen: exportiert wird, was
 * die Seite ZEIGT — und dann darf der Name nicht behaupten, das sei die Fassung
 * v22, die das Team kennt.
 */
export function exportDateiname(
  art: 'katalog' | 'phasen', fassung: number, ungespeichert: boolean,
): string {
  return `status-${art}-v${fassung}${ungespeichert ? '-entwurf' : ''}.json`;
}

/** Die Export-Spalten: Anzeige-Spalten plus die rohe CSV-Spalte hinter „Feld". */
export function exportSpalten(
  spalten: readonly SortableColumn<KatalogZeile>[],
): SortableColumn<KatalogZeile>[] {
  return spalten.flatMap(c => (c.key === 'feld' ? [c, CSV_SPALTE] : [c]));
}

/** Kopfzeile + Datenzeilen — rein, damit der Vertrag ohne Datei prüfbar ist. */
export function baueKatalogBlatt(
  zeilen: readonly KatalogZeile[],
  spalten: readonly SortableColumn<KatalogZeile>[],
): { header: string[]; zeilen: (string | number)[][] } {
  const cols = exportSpalten(spalten);
  return {
    header: cols.map(c => c.label),
    zeilen: zeilen.map(z => cols.map(c => (c.exportValue ? c.exportValue(z) : c.accessor(z)))),
  };
}

export function exportiereKatalogXlsx(
  zeilen: readonly KatalogZeile[],
  spalten: readonly SortableColumn<KatalogZeile>[],
  version: number | null,
): { rowCount: number; filename: string } {
  const cols = exportSpalten(spalten);
  const blatt = baueKatalogBlatt(zeilen, spalten);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([blatt.header, ...blatt.zeilen]);
  // Pixelbreite grob in Excel-Zeichenbreite (≈ /7), Fallback 18 Zeichen.
  ws['!cols'] = cols.map(c => ({ wch: c.width ? Math.max(8, Math.round(c.width / 7)) : 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Statuswerte');

  const filename = baueDateiname(version);
  XLSX.writeFile(wb, filename);
  return { rowCount: zeilen.length, filename };
}
