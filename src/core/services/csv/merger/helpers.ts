/**
 * Reine Merge-Helper: Wert-Koerzion, Spalten-Auflösung, Join-Logik.
 *
 * Keine IDB-Zugriffe, keine I/O — pure Funktionen, in jedem Pfad
 * (single/batched) wiederverwendet.
 */

import { isBegleitungStatus } from '@/core/utils/status-canonical';
import { parseGermanDate } from '../dateParse';
import { computeFristDatum } from '../frist';
import type { Antrag, ColumnMappingEntry, CsvSchema } from '../types';

export function coerceValue(raw: string, entry: ColumnMappingEntry | undefined): unknown {
  const s = (raw ?? '').trim();
  if (!s) return '';
  if (!entry) return s;
  if (entry.type === 'date') {
    const iso = parseGermanDate(s);
    return iso ?? s;
  }
  if (entry.type === 'number') {
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : s;
  }
  if (entry.type === 'boolean') {
    const low = s.toLowerCase();
    if (['ja', 'true', '1', 'yes'].includes(low)) return true;
    if (['nein', 'false', '0', 'no'].includes(low)) return false;
    return s;
  }
  return s;
}

export function resolveFieldKey(col: string, entry: ColumnMappingEntry | undefined): string | null {
  if (!entry) return null;
  if (entry.ignore) return null;
  if (entry.canonical) return entry.canonical;
  if (entry.custom) return entry.custom;
  return col.toLowerCase();
}

export function findJoinColumn(schema: CsvSchema): string | null {
  const entry = Object.entries(schema.column_mapping).find(
    ([, e]) => e.canonical === schema.join_key && !e.ignore,
  );
  return entry ? entry[0] : null;
}

/**
 * Fallback: `frist_datum` wird aus phasen-abhaengiger Berechnung in
 * `computeFristDatum` gefuellt, wenn kein Schema explizit ein `frist_datum`
 * mappt:
 * - Antragsphase: `antragsdatum + 90 Tage` (Bearbeitungs-SLA)
 * - Begleitphase: `vn_eingang_datum + 6 Monate` (VN-Frist)
 * - Wenn Quellfeld leer ist: kein `frist_datum`.
 *
 * Explizit gesetztes `frist_datum` (z.B. Dev-Fixture `status-aktive-mini`
 * mit `FRIST_NEU`-Spalte) gewinnt — das Gate prueft auf leeres Feld.
 */
export function applyFristDatumFallback(merged: Antrag): void {
  const current = merged.frist_datum;
  if (current != null && current !== '') return;
  const fd = computeFristDatum(merged as Parameters<typeof computeFristDatum>[0]);
  if (!fd) return;
  merged.frist_datum = fd;
  // Source-Attribution: bei Begleitphase aus vn_eingang_datum, sonst aus antragsdatum.
  const sourceField = isBegleitungStatus(merged.status as string) ? 'vn_eingang_datum' : 'antragsdatum';
  const src = merged._field_sources[sourceField];
  if (src) merged._field_sources.frist_datum = src;
}

export function findMatchingRows(
  schema: CsvSchema,
  rows: Record<string, string>[],
  antrag: Partial<Antrag>,
): Record<string, string>[] {
  const joinCol = findJoinColumn(schema);
  if (!joinCol) return [];

  if (schema.join_key === 'aktenzeichen') {
    const az = antrag.aktenzeichen;
    if (!az) return [];
    return rows.filter(r => (r[joinCol] ?? '').trim() === az);
  }
  if (schema.join_key === 'verbund_id') {
    if (!antrag.verbund_id) return [];
    return rows.filter(r => (r[joinCol] ?? '').trim() === antrag.verbund_id);
  }
  if (schema.join_key === 'akronym') {
    if (!antrag.akronym) return [];
    return rows.filter(r => (r[joinCol] ?? '').trim() === antrag.akronym);
  }
  return [];
}
