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
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
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
 *     custom auf den Antrag direkt geschrieben wurde (Foyer-Default ohne
 *     Wizard-Mapping → `a.vb_titel`).
 *  3. Leer-String — kein Titel verfuegbar.
 *
 * Ohne diese Kaskade waere der Export fuer Anträge ohne explizites Wizard-
 * Mapping leer (genau das Bug-Symptom das den User getriggert hat).
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
): Promise<{ rowCount: number; filename: string }> {
  // Vollen Text-Korpus inkl. der textlosen Antraege laden — der Cursor-Walk
  // ist derselbe wie für die Hybrid-Suche (siehe search-corpus.ts), nur mit
  // `includeEmpty: true`. Der Loader probiert mehrere Field-Name-Kandidaten
  // durch (verbund_titel/vb_titel, projektbeschreibung_text/vb_inhalt/…),
  // damit auch unmapped CSV-Spalten gefunden werden.
  const textMap = await loadAntraegeTextCorpus(idb, programmId, { includeEmpty: true });

  const aoa: string[][] = [
    ['Förderkennzeichen', 'VB Titel', 'Kurzbeschreibung', 'Antragsdatum'],
    ...filtered.map(a => {
      const t = textMap.get(a.aktenzeichen);
      const vbTitel = resolveVbTitel(a, t?.vb ?? '', verbundById);
      return [a.aktenzeichen, vbTitel, t?.abstract ?? '', a.antragsdatum ?? ''];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Spaltenbreiten: FKZ kompakt, VB Titel mittel, Kurzbeschreibung breit
  // (wird in Excel meist umgebrochen — wch ist nur ein Default), Datum schmal.
  ws['!cols'] = [{ wch: 16 }, { wch: 50 }, { wch: 80 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Anträge');

  const filename = buildFilename();
  XLSX.writeFile(wb, filename);
  return { rowCount: filtered.length, filename };
}
