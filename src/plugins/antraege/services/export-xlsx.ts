/**
 * XLSX-Export der gefilterten Antrags-Liste.
 *
 * Drei Spalten: Förderkennzeichen (= aktenzeichen), VB Titel
 * (= verbund_titel), Kurzbeschreibung (= projektbeschreibung_text).
 *
 * Reihenfolge der Zeilen entspricht der `filtered`-Liste aus
 * `useFilteredAntraege` — also exakt der View, die der User auf dem
 * Bildschirm sieht (inkl. Sortierung + Verbund-Clustering).
 *
 * Antraege ohne Text-Felder bekommen leere Strings statt rausgefiltert zu
 * werden — die FKZ-Spalte soll lückenlos sein, sonst stimmen Zeilen-Counts
 * zwischen UI und Excel-Datei nicht überein.
 *
 * Reuses `xlsx@0.18.5` (bereits installiert wegen Auslastungs-Modul).
 */
import * as XLSX from 'xlsx';
import type { AntragListItem } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { loadAntraegeTextCorpus } from './search-corpus';

/** Filename-Format: `antraege-export-2026-05-20-23-15.xlsx` — Datum + Uhrzeit
 *  damit Mehrfach-Exports nicht überschreiben und sich chronologisch sortieren. */
function buildFilename(now: Date = new Date()): string {
  const ts = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  return `antraege-export-${ts}.xlsx`;
}

export async function exportFilteredAntraegeXlsx(
  filtered: readonly AntragListItem[],
  idb: IDBStore,
  programmId: string,
): Promise<{ rowCount: number; filename: string }> {
  // Vollen Text-Korpus inkl. der textlosen Antraege laden — der Cursor-Walk
  // ist derselbe wie für die Hybrid-Suche (siehe search-corpus.ts), nur mit
  // `includeEmpty: true`.
  const textMap = await loadAntraegeTextCorpus(idb, programmId, { includeEmpty: true });

  const aoa: string[][] = [
    ['Förderkennzeichen', 'VB Titel', 'Kurzbeschreibung'],
    ...filtered.map(a => {
      const t = textMap.get(a.aktenzeichen);
      return [a.aktenzeichen, t?.vb ?? '', t?.abstract ?? ''];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Spaltenbreiten: FKZ kompakt, VB Titel mittel, Kurzbeschreibung breit
  // (wird in Excel meist umgebrochen — wch ist nur ein Default).
  ws['!cols'] = [{ wch: 16 }, { wch: 50 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Anträge');

  const filename = buildFilename();
  XLSX.writeFile(wb, filename);
  return { rowCount: filtered.length, filename };
}
