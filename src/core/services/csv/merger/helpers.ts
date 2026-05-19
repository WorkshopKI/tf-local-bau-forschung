/**
 * Reine Merge-Helper: Wert-Koerzion, Spalten-Auflösung, Join-Logik.
 *
 * Keine IDB-Zugriffe, keine I/O — pure Funktionen, in jedem Pfad
 * (single/batched) wiederverwendet.
 */

import { parseGermanDate } from '../dateParse';
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
 * Fallback: `frist_datum` spiegelt `antragsdatum` (D_AAE), wenn kein Schema
 * eine eigene Frist-Spalte mappt. Domain-Entscheidung: die "Frist" eines
 * Antrags ist sein Eingangsdatum — ab da tickt die Bearbeitungs-SLA
 * (Schwellen in `src/plugins/antraege/eingangAmpel.ts`). Antraege ohne
 * `antragsdatum` bekommen kein `frist_datum` und tauchen in den
 * Frist-Views nicht auf.
 *
 * Explizit gesetztes `frist_datum` (z.B. Dev-Fixture `status-aktive-mini`
 * mit `FRIST_NEU`-Spalte) gewinnt — das Gate prüft auf leeres Feld.
 */
export function applyFristDatumFallback(merged: Antrag): void {
  const current = merged.frist_datum;
  const empty = current == null || current === '';
  if (!empty) return;
  const ad = merged.antragsdatum;
  if (typeof ad !== 'string' || ad.length === 0) return;
  merged.frist_datum = ad;
  const src = merged._field_sources.antragsdatum;
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
