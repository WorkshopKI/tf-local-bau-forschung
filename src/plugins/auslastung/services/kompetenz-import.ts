/**
 * Kompetenz-Import (v2.15) — liest die PL-Kompetenz-XLSX und baut Preview +
 * Apply.
 *
 * XLSX-Layout (wide, 2 Header-Zeilen, Daten ab Zeile 3):
 *   Zeile 1: Überkategorie-IDs (IT/DT/EU/LG/NM) als Merge-Header über ihren
 *            Unterkategorie-Spalten.
 *   Zeile 2: Spalten-Labels — Antragstyp-Kontingent (DL/DS/NW/FuE), TIB_KUERZ,
 *            Abschlag, dann je Unterkategorie ein Label.
 *   Zeile 3+: pro MA eine Zeile; Zellwerte 1/2/3 = Kompetenz-Level.
 *
 * Pro Zeile:
 *   - TIB_KUERZ → anonId via Kürzel-Map (NFC, Pitfall #22). Unbekannt → Warnung,
 *     Zeile übersprungen (keine Phantom-MAs).
 *   - Kompetenz-Matrix (gesetzte Zellen), Kontingent pro Typ (Anträge/Jahr),
 *     Abschlag %.
 *   - Haupt-/Nebenkategorie werden im Store-Apply aus der Matrix abgeleitet.
 *
 * Merge-Semantik = Überschreiben (Upload gewinnt) — siehe `applyKompetenzMatrixBatch`.
 */
import * as XLSX from 'xlsx';
import {
  ALL_ANTRAGSTYP_BUCKETS,
  type AntragstypBucket,
  type AuslastungData,
  type KompetenzLevel,
  type KompetenzMatrix,
  type KompetenzSchemaEntry,
} from '../types';
import { resolveAnonIdForUser, type AnonymMap } from './anonym-map';
import { deriveHauptNeben } from './kompetenz-derivation';
import type { UeberkategorieId } from './default-labels';
import { useAuslastungData, type KompetenzMatrixUpdate } from '../hooks/useAuslastungData';

const VALID_UEBER: ReadonlySet<string> = new Set(['IT', 'DT', 'EU', 'LG', 'NM']);
const VALID_LEVELS: ReadonlySet<number> = new Set([1, 2, 3]);

export interface KompetenzRow {
  /** Rohes Kürzel aus dem XLSX (Anzeige). */
  kuerzel: string;
  /** Aufgelöste anonId oder null (unbekanntes Kürzel). */
  anonId: string | null;
  kompetenzMatrix?: KompetenzMatrix;
  jahresKapazitaetProTyp?: Partial<Record<AntragstypBucket, number>>;
  abschlagProzent?: number;
  /** Abgeleitete Hauptkategorie (nur Preview-Anzeige). */
  hauptKategorie: string;
  nebenKategorien: string[];
  /** Anzahl gesetzter Kompetenz-Zellen. */
  subCount: number;
  warnings: string[];
}

export interface KompetenzImportPreview {
  rows: KompetenzRow[];
  /** Erkanntes Spalten-Schema (Überkat. → Unterkat.-Labels). */
  schema: KompetenzSchemaEntry[];
  /** Gesamtfehler — Datei unbrauchbar. */
  fatal?: string;
  summary: { total: number; valid: number; warnings: number; unknownMa: number };
}

function normUeber(raw: unknown): UeberkategorieId | null {
  const s = String(raw ?? '').trim().toUpperCase();
  return VALID_UEBER.has(s) ? (s as UeberkategorieId) : null;
}

function asLevel(v: unknown): KompetenzLevel | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return VALID_LEVELS.has(n) ? (n as KompetenzLevel) : null;
}

/** Findet die Spalte, deren Label (normalisiert) einem der Aliase entspricht. */
function findCol(header: string[], aliases: string[]): number {
  const lower = header.map(h => String(h ?? '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  for (const a of aliases) {
    const idx = lower.indexOf(a);
    if (idx >= 0) return idx;
  }
  return -1;
}

function fatal(msg: string): KompetenzImportPreview {
  return { rows: [], schema: [], fatal: msg, summary: { total: 0, valid: 0, warnings: 0, unknownMa: 0 } };
}

/** Liest die XLSX, baut Preview + erkanntes Schema. */
export async function parseKompetenzXlsx(
  file: File,
  data: AuslastungData,
  anonymMap: AnonymMap,
): Promise<KompetenzImportPreview> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch (err) {
    return fatal(`XLSX konnte nicht gelesen werden: ${err instanceof Error ? err.message : String(err)}`);
  }

  const ws = wb.Sheets[wb.SheetNames[0] ?? ''];
  if (!ws) return fatal('Keine Tabelle in der Datei gefunden.');

  const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
  if (aoa.length < 3) return fatal('Datei zu kurz — erwartet werden 2 Kopfzeilen + mindestens eine Datenzeile.');

  const ueberRow = (aoa[0] ?? []).map(c => String(c ?? ''));
  const labelRow = (aoa[1] ?? []).map(c => String(c ?? ''));
  const merges = ws['!merges'] ?? [];

  // Fixe Spalten.
  const iKuerzel = findCol(labelRow, ['tibkuerz', 'tibkuerzel', 'kuerzel', 'kürzel', 'kuerz']);
  if (iKuerzel < 0) return fatal('Pflicht-Spalte „TIB_KUERZ" nicht gefunden (Zeile 2).');
  const iAbschlag = findCol(labelRow, ['abschlag']);
  const bucketCols: Array<[AntragstypBucket, number]> = [];
  for (const b of ALL_ANTRAGSTYP_BUCKETS) {
    const idx = findCol(labelRow, [b.toLowerCase()]);
    if (idx >= 0) bucketCols.push([b, idx]);
  }

  // Überkategorie pro Spalte: aus Merge-Spans (Zeile 1) + Einzelzellen (z.B. NM).
  const ueberByCol = new Map<number, UeberkategorieId>();
  for (const m of merges) {
    if (m.s.r !== 0) continue;
    const id = normUeber(ueberRow[m.s.c]);
    if (!id) continue;
    for (let c = m.s.c; c <= m.e.c; c++) ueberByCol.set(c, id);
  }
  for (let c = 0; c < ueberRow.length; c++) {
    if (ueberByCol.has(c)) continue;
    const id = normUeber(ueberRow[c]);
    if (id) ueberByCol.set(c, id);
  }
  // Fixe Spalten dürfen nie als Unterkategorie-Spalte gelten.
  for (const c of [iKuerzel, iAbschlag, ...bucketCols.map(([, i]) => i)]) {
    if (c >= 0) ueberByCol.delete(c);
  }

  // Unterkategorie-Spalten in Spaltenreihenfolge → Schema.
  const subCols: Array<{ col: number; ueber: UeberkategorieId; label: string }> = [];
  const maxCol = Math.max(ueberRow.length, labelRow.length);
  for (let c = 0; c < maxCol; c++) {
    const ueber = ueberByCol.get(c);
    if (!ueber) continue;
    const label = String(labelRow[c] ?? '').trim();
    if (!label) continue;
    subCols.push({ col: c, ueber, label });
  }
  if (subCols.length === 0) {
    return fatal('Keine Kompetenz-Spalten erkannt — fehlt die Überkategorie-Kopfzeile (IT/DT/EU/LG/NM)?');
  }
  const schema = buildSchema(subCols, data);

  // Datenzeilen.
  const rows: KompetenzRow[] = [];
  for (let r = 2; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const rawKuerzel = String(row[iKuerzel] ?? '').trim();
    if (!rawKuerzel) continue;

    const anonId = resolveAnonIdForUser(rawKuerzel, anonymMap);
    const warnings: string[] = [];

    const matrix: KompetenzMatrix = {};
    let subCount = 0;
    for (const sc of subCols) {
      const lvl = asLevel(row[sc.col]);
      if (!lvl) continue;
      (matrix[sc.ueber] ??= {})[sc.label] = lvl;
      subCount++;
    }
    const kompetenzMatrix = subCount > 0 ? matrix : undefined;

    const kontingent: Partial<Record<AntragstypBucket, number>> = {};
    for (const [b, col] of bucketCols) {
      const v = Number(String(row[col] ?? '').trim().replace(',', '.'));
      if (Number.isFinite(v) && v > 0) kontingent[b] = v;
    }
    const jahresKapazitaetProTyp = Object.keys(kontingent).length > 0 ? kontingent : undefined;

    let abschlagProzent: number | undefined;
    if (iAbschlag >= 0) {
      const rawA = String(row[iAbschlag] ?? '').trim().replace('%', '').replace(',', '.');
      if (rawA !== '') {
        const v = Number(rawA);
        if (Number.isFinite(v) && v >= 0) abschlagProzent = Math.min(100, v);
      }
    }

    const { hauptKategorie, nebenKategorien } = deriveHauptNeben(kompetenzMatrix);

    if (!anonId) {
      warnings.push('Unbekanntes Kürzel — nicht in der Kürzel-Map, wird übersprungen');
    } else if (subCount === 0 && !jahresKapazitaetProTyp && abschlagProzent == null) {
      warnings.push('Zeile ohne Kompetenzen / Kontingent / Abschlag');
    }

    rows.push({
      kuerzel: rawKuerzel,
      anonId,
      kompetenzMatrix,
      jahresKapazitaetProTyp,
      abschlagProzent,
      hauptKategorie,
      nebenKategorien,
      subCount,
      warnings,
    });
  }

  const summary = {
    total: rows.length,
    valid: rows.filter(r => r.anonId !== null).length,
    warnings: rows.filter(r => r.warnings.length > 0).length,
    unknownMa: rows.filter(r => r.anonId === null).length,
  };
  return { rows, schema, summary };
}

/** Gruppiert die Unterkategorie-Spalten nach Überkategorie (Reihenfolge =
 *  erstes Auftreten). Überkat.-Label = Klarname aus der Config, sonst die ID. */
function buildSchema(
  subCols: Array<{ ueber: UeberkategorieId; label: string }>,
  data: AuslastungData,
): KompetenzSchemaEntry[] {
  const nameById = new Map(data.config.ueberKategorien.map(k => [k.id, k.name]));
  const byUeber = new Map<UeberkategorieId, string[]>();
  const order: UeberkategorieId[] = [];
  for (const { ueber, label } of subCols) {
    if (!byUeber.has(ueber)) { byUeber.set(ueber, []); order.push(ueber); }
    byUeber.get(ueber)!.push(label);
  }
  return order.map(u => ({ ueberId: u, label: nameById.get(u) ?? u, subKategorien: byUeber.get(u)! }));
}

/**
 * Wendet den Preview an: alle Zeilen mit aufgelöster anonId werden überschrieben,
 * das erkannte Schema in die Config geschrieben. EIN setState + EIN persist im
 * Store (Pitfall #16/#20).
 */
export async function applyKompetenzImport(
  storage: import('@/core/services/storage').StorageService,
  preview: KompetenzImportPreview,
): Promise<{ applied: number; created: number; skipped: number }> {
  const updates: KompetenzMatrixUpdate[] = preview.rows
    .filter((r): r is KompetenzRow & { anonId: string } => r.anonId !== null)
    .map(r => ({
      anonId: r.anonId,
      kompetenzMatrix: r.kompetenzMatrix,
      jahresKapazitaetProTyp: r.jahresKapazitaetProTyp,
      abschlagProzent: r.abschlagProzent,
    }));
  const skipped = preview.rows.length - updates.length;
  const { applied, created } = await useAuslastungData
    .getState()
    .applyKompetenzMatrixBatch(storage, updates, preview.schema);
  return { applied, created, skipped };
}
