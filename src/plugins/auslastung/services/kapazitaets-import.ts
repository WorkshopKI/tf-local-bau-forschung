/**
 * Kapazitaets-Import.
 *
 * Zwei Funktionen:
 *  - downloadKapazitaetsTemplate(data) — erzeugt XLSX-Vorlage mit Ist-Werten
 *  - parseKapazitaetsXlsx(file) — liest XLSX, gibt Preview + Validierung zurueck
 *  - applyKapazitaetsImport(storage, preview, currentData) — schreibt Merge in store
 *
 * Sheet 1 "Kapazitaeten":
 *   MA_NR | Jahreskapazitaet_Stunden | Abgemeldet_Quartale (Komma-getrennt)
 *
 * Sheet 2 "Technologien":
 *   MA_NR | Technologie_1 | Technologie_2 | ... | Technologie_10
 *
 * Merge-Regeln:
 *  - MA_NR existiert -> Jahreskapazitaet/Abgemeldet/Technologien werden ueberschrieben
 *  - MA_NR unbekannt -> Warnung im Preview, NICHT automatisch angelegt
 *  - Pflichtfeld Jahreskapazitaet leer -> Warnung, Zeile uebersprungen
 */
import * as XLSX from 'xlsx';
import type { StorageService } from '@/core/services/storage';
import type { AnonymerMitarbeiter, AuslastungData } from '../types';
import { useAuslastungData } from '../hooks/useAuslastungData';

export interface KapazitaetsRow {
  anonId: string;
  jahresKapazitaet?: number;
  abgemeldet?: string[];
  manuelleTechnologien?: string[];
  /** Validierungs-Status pro Zeile. */
  warnings: string[];
}

export interface KapazitaetsImportPreview {
  rows: KapazitaetsRow[];
  /** Gesamtfehler — Datei unbrauchbar. */
  fatal?: string;
  summary: {
    total: number;
    valid: number;
    warnings: number;
    unknownMa: number;
  };
}

const SHEET_KAPAZITAETEN = 'Kapazitäten';
const SHEET_TECHNOLOGIEN = 'Technologien';
const FALLBACK_SHEET_KAPAZITAETEN = 'Kapazitaeten'; // Encoding-Fallback ohne Umlaute

/** Spalten-Header — case-insensitive matched. */
const COL_MA = ['ma_nr', 'manr', 'ma'];
const COL_KAP = ['jahreskapazitaet_stunden', 'jahreskapazitaet', 'kapazitaet'];
const COL_ABGEMELDET = ['abgemeldet_quartale', 'abgemeldet'];

function findColumnIndex(header: string[], aliases: string[]): number {
  const lower = header.map(h => String(h).toLowerCase().trim().replace(/[^a-z0-9_]/g, ''));
  for (const a of aliases) {
    const idx = lower.indexOf(a);
    if (idx >= 0) return idx;
  }
  return -1;
}

function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false });
}

/**
 * Erzeugt eine XLSX-Vorlage als Blob, gefuellt mit den aktuellen Werten
 * aus `data.mitarbeiter`.
 */
export function downloadKapazitaetsTemplate(data: AuslastungData): void {
  const wb = XLSX.utils.book_new();
  const sorted = Object.values(data.mitarbeiter).sort((a, b) => a.anonId.localeCompare(b.anonId));

  // Sheet 1 — Kapazitaeten
  const kapAoA: Array<Array<string | number>> = [
    ['MA_NR', 'Jahreskapazitaet_Stunden', 'Abgemeldet_Quartale'],
    ...sorted.map(m => [m.anonId, m.jahresKapazitaet, m.abgemeldet.join(', ')]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(kapAoA);
  ws1['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws1, SHEET_KAPAZITAETEN);

  // Sheet 2 — Technologien (Max 10 Spalten)
  const techHeader = ['MA_NR', ...Array.from({ length: 10 }, (_, i) => `Technologie_${i + 1}`)];
  const techRows = sorted.map(m => {
    const row: Array<string | number> = [m.anonId];
    for (let i = 0; i < 10; i++) {
      row.push(m.manuelleTechnologien[i] ?? '');
    }
    return row;
  });
  const ws2 = XLSX.utils.aoa_to_sheet([techHeader, ...techRows]);
  ws2['!cols'] = [{ wch: 10 }, ...Array.from({ length: 10 }, () => ({ wch: 18 }))];
  XLSX.utils.book_append_sheet(wb, ws2, SHEET_TECHNOLOGIEN);

  XLSX.writeFile(wb, `auslastung-kapazitaeten-vorlage.xlsx`);
}

/**
 * Liest eine vom User editierte XLSX und baut den Merge-Preview.
 * Validiert pro Zeile.
 */
export async function parseKapazitaetsXlsx(
  file: File,
  currentData: AuslastungData,
): Promise<KapazitaetsImportPreview> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (err) {
    return {
      rows: [],
      fatal: `XLSX konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`,
      summary: { total: 0, valid: 0, warnings: 0, unknownMa: 0 },
    };
  }

  const sheetK = wb.Sheets[SHEET_KAPAZITAETEN] ?? wb.Sheets[FALLBACK_SHEET_KAPAZITAETEN];
  const sheetT = wb.Sheets[SHEET_TECHNOLOGIEN];
  if (!sheetK) {
    return {
      rows: [],
      fatal: `Sheet "${SHEET_KAPAZITAETEN}" fehlt.`,
      summary: { total: 0, valid: 0, warnings: 0, unknownMa: 0 },
    };
  }

  const rowsK = sheetToRows(sheetK);
  if (rowsK.length === 0) {
    return {
      rows: [],
      fatal: `Sheet "${SHEET_KAPAZITAETEN}" ist leer.`,
      summary: { total: 0, valid: 0, warnings: 0, unknownMa: 0 },
    };
  }

  const headerK = rowsK[0]!.map(h => String(h ?? ''));
  const iMa = findColumnIndex(headerK, COL_MA);
  const iKap = findColumnIndex(headerK, COL_KAP);
  const iAbg = findColumnIndex(headerK, COL_ABGEMELDET);
  if (iMa < 0 || iKap < 0) {
    return {
      rows: [],
      fatal: `Pflicht-Spalten "MA_NR" oder "Jahreskapazitaet_Stunden" fehlen.`,
      summary: { total: 0, valid: 0, warnings: 0, unknownMa: 0 },
    };
  }

  const byMa = new Map<string, KapazitaetsRow>();
  for (let r = 1; r < rowsK.length; r++) {
    const row = rowsK[r]!;
    const anonId = String(row[iMa] ?? '').trim().toUpperCase();
    if (!anonId) continue;
    const warnings: string[] = [];
    const kapRaw = row[iKap];
    const kapNum = typeof kapRaw === 'number' ? kapRaw : Number(String(kapRaw ?? '').trim().replace(',', '.'));
    if (!Number.isFinite(kapNum) || kapNum <= 0) {
      warnings.push('Jahreskapazitaet ungueltig oder leer');
    }
    const abgemeldet = iAbg >= 0
      ? String(row[iAbg] ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
      : [];
    if (!currentData.mitarbeiter[anonId]) {
      warnings.push('Unbekannte MA-ID — wird ignoriert');
    }
    byMa.set(anonId, {
      anonId,
      jahresKapazitaet: Number.isFinite(kapNum) && kapNum > 0 ? kapNum : undefined,
      abgemeldet,
      warnings,
    });
  }

  // Sheet 2 — Technologien
  if (sheetT) {
    const rowsT = sheetToRows(sheetT);
    if (rowsT.length > 0) {
      const headerT = rowsT[0]!.map(h => String(h ?? ''));
      const iMaT = findColumnIndex(headerT, COL_MA);
      if (iMaT >= 0) {
        for (let r = 1; r < rowsT.length; r++) {
          const row = rowsT[r]!;
          const anonId = String(row[iMaT] ?? '').trim().toUpperCase();
          if (!anonId) continue;
          const tech: string[] = [];
          for (let c = 0; c < row.length; c++) {
            if (c === iMaT) continue;
            const v = String(row[c] ?? '').trim();
            if (v) tech.push(v);
          }
          const existing = byMa.get(anonId);
          if (existing) {
            existing.manuelleTechnologien = tech;
          } else {
            const warnings = !currentData.mitarbeiter[anonId] ? ['Unbekannte MA-ID — wird ignoriert'] : [];
            byMa.set(anonId, { anonId, manuelleTechnologien: tech, warnings });
          }
        }
      }
    }
  }

  const rows = [...byMa.values()].sort((a, b) => a.anonId.localeCompare(b.anonId));
  const summary = {
    total: rows.length,
    valid: rows.filter(r => r.warnings.length === 0 && currentData.mitarbeiter[r.anonId]).length,
    warnings: rows.filter(r => r.warnings.length > 0).length,
    unknownMa: rows.filter(r => !currentData.mitarbeiter[r.anonId]).length,
  };
  return { rows, summary };
}

/**
 * Wendet den Preview auf den Auslastungs-Store an. Zeilen mit
 * fataler Warnung (unbekannte MA-ID, kein Kapazitaet-Wert) werden
 * uebersprungen.
 */
export async function applyKapazitaetsImport(
  storage: StorageService,
  preview: KapazitaetsImportPreview,
): Promise<{ applied: number; skipped: number }> {
  const state = useAuslastungData.getState();
  let applied = 0, skipped = 0;
  for (const row of preview.rows) {
    const existing = state.data.mitarbeiter[row.anonId];
    if (!existing) { skipped++; continue; }
    const next: AnonymerMitarbeiter = { ...existing };
    if (row.jahresKapazitaet != null) next.jahresKapazitaet = row.jahresKapazitaet;
    if (row.abgemeldet != null) next.abgemeldet = row.abgemeldet;
    if (row.manuelleTechnologien != null) next.manuelleTechnologien = row.manuelleTechnologien;
    await state.upsertMitarbeiter(storage, next);
    applied++;
  }
  return { applied, skipped };
}
