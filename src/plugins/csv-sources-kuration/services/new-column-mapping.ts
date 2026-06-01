/**
 * Mapping-Helfer für das nachträgliche Übernehmen neuer CSV-Spalten in ein
 * bestehendes Schema (`CsvAddColumnsDialog`).
 *
 * Im Gegensatz zum Wizard (`buildColumnMapping` baut das KOMPLETTE Mapping neu)
 * arbeiten diese Funktionen rein additiv: das bestehende `column_mapping` bleibt
 * byte-genau erhalten, nur die neuen Spalten-Keys werden ergänzt. Damit gehen
 * keine sorgfältig gepflegten Mappings, Labels oder Gruppen-Pfade der bereits
 * registrierten Spalten verloren.
 *
 * Neue Spalten haben keine Label-XLS-Herkunft → es werden bewusst KEINE
 * `label`/`group_path`/`ambiguous_merge_resolution`-Felder gesetzt (anders als
 * `buildColumnMapping`, das diese aus dem geladenen Label-XLS ableitet).
 */

import type { ColumnMapping, ColumnMappingEntry } from '@/core/services/csv/types';
import type { PerColumnDecision } from '../wizard/useCsvWizardState';

/**
 * Baut den `ColumnMappingEntry` für EINE neue Spalte aus der Kurator-Entscheidung.
 * Spiegelt die Pro-Spalte-Logik aus `buildColumnMapping` (canonical/custom/ignore
 * + type + trackHistory), ohne die Label-XLS-abhängigen Felder.
 */
export function buildNewColumnEntry(col: string, d: PerColumnDecision): ColumnMappingEntry {
  if (d.mode === 'ignore') {
    return { ignore: true };
  }
  if (d.mode === 'canonical' && d.canonical) {
    return {
      canonical: d.canonical,
      type: d.type ?? 'string',
      trackHistory: d.trackHistory ?? false,
    };
  }
  if (d.mode === 'custom') {
    return {
      custom: (d.custom && d.custom.trim()) || col.toLowerCase(),
      type: d.type ?? 'string',
      trackHistory: d.trackHistory ?? false,
    };
  }
  // Fallback (canonical-Modus ohne Ziel-Feld): als Custom durchreichen.
  return { custom: col.toLowerCase(), type: 'string', trackHistory: false };
}

/**
 * Merged die neuen Spalten-Entscheidungen in ein bestehendes `column_mapping`.
 * Bestehende Einträge werden NICHT überschrieben (neue Keys kollidieren per
 * Definition nicht — sie sind ja „nicht im Schema"). Liefert ein neues Objekt.
 */
export function mergeNewColumns(
  existing: ColumnMapping,
  newDecisions: Record<string, PerColumnDecision>,
): ColumnMapping {
  const additions: ColumnMapping = {};
  for (const [col, d] of Object.entries(newDecisions)) {
    additions[col] = buildNewColumnEntry(col, d);
  }
  return { ...existing, ...additions };
}
