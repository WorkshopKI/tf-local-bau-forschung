import { CANONICAL_FIELD_KEYS, getCanonicalLabel } from '@/core/services/csv/constants';
import { formatGermanDate } from '@/core/services/csv';
import type { Antrag, CsvSchema } from '@/core/services/csv/types';
import { getVbPhaseLabel } from '@/core/utils/vb-phase-mappings';

export interface DisplayRow {
  field: string;
  label: string;
  value: string;
  rawValue: unknown;
  sourceSchemaId: string | undefined;
  isCanonical: boolean;
}

export interface DisplayGroup {
  /** Leer für "Weitere Felder" (Felder ohne group_path). */
  path: string[];
  /** Anzeige-Label: path.join(' › ') oder "Weitere Felder". */
  label: string;
  rows: DisplayRow[];
}

const OTHER_LABEL = 'Weitere Felder';

/**
 * Wenn `schemas` mitgegeben werden, wird das Custom-Field-Label aus dem
 * Schema-Mapping (XLS-Label) gelesen — sonst Fallback auf den prettyfied
 * Slug. Das Schema-Label respektiert Umlaute + Klammer-Suffixe wie
 * "Künstliche Intelligenz (KI)", die im Slug verloren gehen.
 *
 * Rang-Reihenfolge wie in `groupDisplayRows`: dominante Source > Master >
 * höchste Priority > erste Source mit Label.
 */
export function buildDisplayRows(antrag: Antrag, schemas: CsvSchema[] = []): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const seen = new Set<string>();
  const schemaById = new Map(schemas.map(s => [s.id, s]));
  const rankedSchemas = [...schemas].sort((a, b) => {
    if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  for (const key of CANONICAL_FIELD_KEYS) {
    if (antrag[key] !== undefined && antrag[key] !== '') {
      rows.push(toDisplayRow(antrag, key, true, schemaById, rankedSchemas));
      seen.add(key);
    }
  }

  const customKeys = Object.keys(antrag)
    .filter(k => !seen.has(k) && !k.startsWith('_') && !['aktenzeichen', 'programm_id'].includes(k))
    .sort();

  for (const key of customKeys) {
    rows.push(toDisplayRow(antrag, key, false, schemaById, rankedSchemas));
  }

  return rows;
}

/**
 * Gruppiert die flache DisplayRow-Liste nach group_path aus den beteiligten CSV-Schemas.
 *
 * Regeln:
 * - Pro Feld wird die dominante Source ermittelt: Master > höchste Priority > erste Source mit group_path
 * - Felder ohne group_path landen in Gruppe "Weitere Felder" (path: [])
 * - Reihenfolge der Gruppen: erste Gruppe = erste Feld-Vorkommen; "Weitere Felder" immer am Ende
 * - Wenn keine Source group_path liefert, kommt nur eine einzige Gruppe zurück (path: []); der Consumer
 *   soll dann die flache Ansicht ohne Gruppen-Header rendern
 */
export function groupDisplayRows(rows: DisplayRow[], schemas: CsvSchema[]): DisplayGroup[] {
  if (rows.length === 0) return [];
  const schemaById = new Map(schemas.map(s => [s.id, s]));
  // Sortiere Schemas für Tie-Breaking (Master zuerst, dann Priority desc)
  const rankedSchemas = [...schemas].sort((a, b) => {
    if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });

  function resolveGroupPath(row: DisplayRow): string[] {
    // 1. Dominante Source zuerst prüfen
    if (row.sourceSchemaId) {
      const s = schemaById.get(row.sourceSchemaId);
      const entry = s?.column_mapping
        ? findMappingEntry(s.column_mapping, row.field)
        : null;
      if (entry?.group_path && entry.group_path.length > 0) return entry.group_path;
    }
    // 2. Fallback: anderen Schemas mit group_path nach Rang durchsuchen
    for (const s of rankedSchemas) {
      if (!s.column_mapping) continue;
      const entry = findMappingEntry(s.column_mapping, row.field);
      if (entry?.group_path && entry.group_path.length > 0) return entry.group_path;
    }
    return [];
  }

  const order: string[] = [];
  const buckets = new Map<string, DisplayGroup>();

  for (const row of rows) {
    const path = resolveGroupPath(row);
    const key = path.length === 0 ? '__other__' : path.join(' › ');
    const label = path.length === 0 ? OTHER_LABEL : key;
    if (!buckets.has(key)) {
      buckets.set(key, { path, label, rows: [] });
      order.push(key);
    }
    buckets.get(key)!.rows.push(row);
  }

  const withoutOther = order.filter(k => k !== '__other__').map(k => buckets.get(k)!);
  const other = buckets.get('__other__');
  return other ? [...withoutOther, other] : withoutOther;
}

/**
 * Findet den ColumnMappingEntry, der auf ein kanonisches oder custom Feld mappt.
 * (Das Feld im Antrag-Objekt heißt entweder canonical-key oder custom-name.)
 */
function findMappingEntry(
  mapping: CsvSchema['column_mapping'],
  fieldKey: string,
): CsvSchema['column_mapping'][string] | null {
  for (const entry of Object.values(mapping)) {
    if (entry.canonical === fieldKey) return entry;
    if (entry.custom === fieldKey) return entry;
  }
  return null;
}

function toDisplayRow(
  antrag: Antrag,
  key: string,
  isCanonical: boolean,
  schemaById: Map<string, CsvSchema>,
  rankedSchemas: CsvSchema[],
): DisplayRow {
  const rawValue = antrag[key];
  const sourceSchemaId = antrag._field_sources?.[key];
  const label = isCanonical
    ? getCanonicalLabel(key)
    : resolveCustomLabel(key, sourceSchemaId, schemaById, rankedSchemas);
  const value = formatValue(rawValue, key);
  return { field: key, label, value, rawValue, sourceSchemaId, isCanonical };
}

/**
 * Custom-Field-Label aus dem Schema-Mapping (XLS-Label) — Fallback:
 * prettyfied Slug. Reihenfolge wie in `resolveGroupPath`: erst dominante
 * Source, dann andere Schemas nach Rang.
 *
 * Wichtig fuer Umlaute/Sonderzeichen: der Slug-Field-Name verliert sie
 * (`kunstliche_intelligenz_ki_tv_ebene`), das XLS-Label bewahrt sie
 * ("Künstliche Intelligenz (KI)").
 */
function resolveCustomLabel(
  field: string,
  sourceSchemaId: string | undefined,
  schemaById: Map<string, CsvSchema>,
  rankedSchemas: CsvSchema[],
): string {
  if (sourceSchemaId) {
    const s = schemaById.get(sourceSchemaId);
    const entry = s?.column_mapping ? findMappingEntry(s.column_mapping, field) : null;
    if (entry?.label) return entry.label;
  }
  for (const s of rankedSchemas) {
    if (!s.column_mapping) continue;
    const entry = findMappingEntry(s.column_mapping, field);
    if (entry?.label) return entry.label;
  }
  return prettyCustomLabel(field);
}

function prettyCustomLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(raw: unknown, field: string): string {
  if (raw === null || raw === undefined || raw === '') return '—';
  if (field === 'vb_phase') {
    const label = getVbPhaseLabel(raw);
    return label ?? String(raw);
  }
  if (typeof raw === 'boolean') return raw ? 'ja' : 'nein';
  if (typeof raw === 'number') {
    if (field === 'foerdersumme') return raw.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    return raw.toLocaleString('de-DE');
  }
  if (typeof raw === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw) && field.endsWith('datum')) return formatGermanDate(raw);
    return raw;
  }
  return String(raw);
}
