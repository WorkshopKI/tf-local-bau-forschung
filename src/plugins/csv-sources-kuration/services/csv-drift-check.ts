/**
 * Schema-vs-CSV-Spalten-Drift-Erkennung.
 *
 * Wird vor jedem Re-Import (manuell oder Auto-Refresh) aufgerufen, um zu
 * pruefen, ob die aktuell vorliegende CSV-Datei dieselben Spalten hat wie
 * beim letzten Import. Die Auto-Refresh-Pipeline zieht Quellen mit
 * unveraendertem Header silent durch; bei Drift entscheidet sie anhand der
 * Drift-Art (siehe `isNewColumnsOnlyDrift`), ob sie die Zusatzspalten headless
 * uebernimmt oder die Quelle dem Kurator zur manuellen Bearbeitung vorlegt.
 *
 * Logik:
 *  - `matched`        : Schema-Spalten, die in der CSV vorhanden sind
 *  - `missingFromCsv` : Schema-Spalten, die in der CSV fehlen
 *                      -> Felder bleiben beim Import leer (BLOCKIEREND)
 *  - `newColumns`     : CSV-Spalten, die im Schema nicht gemappt sind
 *                      -> werden beim Import ignoriert (harmlos → Auto-Adopt)
 *
 * `hasDrift(v)`             = (missingFromCsv UND/ODER newColumns nicht leer).
 * `isNewColumnsOnlyDrift(v)` = nur Zusatzspalten, nichts fehlt → Auto-Refresh
 *   uebernimmt sie headless als `{ ignore: true }` (kein Block).
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

/**
 * Reine „neue Spalten"-Drift: es fehlt keine gemappte Schema-Spalte, aber die
 * CSV bringt zusätzliche (noch nicht gemappte) Spalten mit. Dieser Fall ist für
 * den Import harmlos (unbekannte Spalten werden ohnehin ignoriert) und darf im
 * Auto-Refresh headless als `{ ignore: true }` übernommen werden, statt den
 * täglichen Import zu blockieren. `missingFromCsv > 0` bleibt dagegen der
 * gefährliche Fall (leert echte Felder) → weiter Kurator-Review.
 */
export function isNewColumnsOnlyDrift(v: HeaderValidation): boolean {
  return v.missingFromCsv.length === 0 && v.newColumns.length > 0;
}
