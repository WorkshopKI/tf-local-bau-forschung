/**
 * Tests für die Schema-vs-CSV-Spalten-Drift-Erkennung.
 *
 * Kern-Garantie: `validateHeaders` partitioniert korrekt in matched / fehlend /
 * neu; `hasDrift` schlägt bei jeder Abweichung an; `isNewColumnsOnlyDrift`
 * unterscheidet den harmlosen „nur Zusatzspalten"-Fall (Auto-Adopt) vom
 * gefährlichen „gemappte Spalte fehlt"-Fall (bleibt blockierend).
 */
import { describe, it, expect } from 'vitest';
import type { CsvSchema, ColumnMapping } from '@/core/services/csv/types';
import {
  validateHeaders,
  hasDrift,
  isNewColumnsOnlyDrift,
  type HeaderValidation,
} from '../csv-drift-check';

/** Minimales CsvSchema — validateHeaders liest nur `column_mapping`. */
function mkSchema(mapping: ColumnMapping): CsvSchema {
  return {
    id: 'q-test',
    programm_id: 'p1',
    csv_source_name: 'Testquelle',
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 1,
    column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const MAPPING: ColumnMapping = {
  AKZ: { canonical: 'aktenzeichen', type: 'string' },
  STATUS: { canonical: 'status', type: 'string' },
  EXPORT_TS: { ignore: true },
};

describe('validateHeaders', () => {
  it('partitioniert matched / missingFromCsv / newColumns korrekt', () => {
    // CSV hat AKZ + STATUS (matched), nicht EXPORT_TS (missing), plus NEU_1/NEU_2 (neu).
    const v = validateHeaders(mkSchema(MAPPING), ['AKZ', 'STATUS', 'NEU_1', 'NEU_2']);
    expect(v.matched.sort()).toEqual(['AKZ', 'STATUS']);
    expect(v.missingFromCsv).toEqual(['EXPORT_TS']);
    expect(v.newColumns.sort()).toEqual(['NEU_1', 'NEU_2']);
  });

  it('liefert leere Drift-Mengen bei exakt gleichem Header', () => {
    const v = validateHeaders(mkSchema(MAPPING), ['AKZ', 'STATUS', 'EXPORT_TS']);
    expect(v.matched.sort()).toEqual(['AKZ', 'EXPORT_TS', 'STATUS']);
    expect(v.missingFromCsv).toEqual([]);
    expect(v.newColumns).toEqual([]);
  });
});

describe('hasDrift', () => {
  const mk = (missing: string[], neu: string[]): HeaderValidation => ({
    matched: [],
    missingFromCsv: missing,
    newColumns: neu,
  });

  it('true bei fehlenden Spalten', () => expect(hasDrift(mk(['A'], []))).toBe(true));
  it('true bei neuen Spalten', () => expect(hasDrift(mk([], ['B']))).toBe(true));
  it('true bei beidem', () => expect(hasDrift(mk(['A'], ['B']))).toBe(true));
  it('false bei keiner Abweichung', () => expect(hasDrift(mk([], []))).toBe(false));
});

describe('isNewColumnsOnlyDrift', () => {
  const mk = (missing: string[], neu: string[]): HeaderValidation => ({
    matched: [],
    missingFromCsv: missing,
    newColumns: neu,
  });

  it('true bei reinen Zusatzspalten (nichts fehlt)', () => {
    expect(isNewColumnsOnlyDrift(mk([], ['NEU']))).toBe(true);
  });

  it('false wenn eine gemappte Spalte fehlt (auch mit Zusatzspalten)', () => {
    expect(isNewColumnsOnlyDrift(mk(['WEG'], []))).toBe(false);
    expect(isNewColumnsOnlyDrift(mk(['WEG'], ['NEU']))).toBe(false);
  });

  it('false ohne jede Drift', () => {
    expect(isNewColumnsOnlyDrift(mk([], []))).toBe(false);
  });
});
