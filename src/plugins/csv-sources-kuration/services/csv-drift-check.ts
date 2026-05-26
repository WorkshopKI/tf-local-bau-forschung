/**
 * Schema-vs-CSV-Spalten-Drift-Erkennung.
 *
 * Wird vor jedem Re-Import (manuell oder Auto-Refresh) aufgerufen, um zu
 * pruefen, ob die aktuell vorliegende CSV-Datei dieselben Spalten hat wie
 * beim letzten Import. Erlaubt der Auto-Refresh-Pipeline, Quellen mit
 * unveraendertem Header silent durchzuziehen und nur abweichende Quellen
 * dem Kurator zur manuellen Bearbeitung vorzulegen.
 *
 * Logik:
 *  - `matched`        : Schema-Spalten, die in der CSV vorhanden sind
 *  - `missingFromCsv` : Schema-Spalten, die in der CSV fehlen
 *                      -> Felder bleiben beim Import leer
 *  - `newColumns`     : CSV-Spalten, die im Schema nicht gemappt sind
 *                      -> werden beim Import ignoriert
 *
 * `hasDrift(v)` ist Drift = (missingFromCsv UND/ODER newColumns nicht leer).
 */

import type { CsvSchema } from '@/core/services/csv/types';

export interface HeaderValidation {
  matched: string[];
  missingFromCsv: string[];
  newColumns: string[];
}

export function validateHeaders(schema: CsvSchema, csvHeaders: string[]): HeaderValidation {
  const schemaCols = Object.keys(schema.column_mapping);
  const csvSet = new Set(csvHeaders);
  const schemaSet = new Set(schemaCols);
  return {
    matched: schemaCols.filter(c => csvSet.has(c)),
    missingFromCsv: schemaCols.filter(c => !csvSet.has(c)),
    newColumns: csvHeaders.filter(c => !schemaSet.has(c)),
  };
}

export function hasDrift(v: HeaderValidation): boolean {
  return v.missingFromCsv.length > 0 || v.newColumns.length > 0;
}
