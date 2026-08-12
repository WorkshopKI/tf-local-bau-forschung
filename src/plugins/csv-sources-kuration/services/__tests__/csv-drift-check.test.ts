/**
 * Tests für die Schema-vs-CSV-Spalten-Drift-Erkennung.
 *
 * Kern-Garantie: `validateHeaders` partitioniert korrekt in matched / fehlend /
 * neu; `hasDrift` schlägt bei jeder Abweichung an; `isNewColumnsOnlyDrift`
 * unterscheidet den harmlosen „nur Zusatzspalten"-Fall (Auto-Adopt) vom
 * gefährlichen „gemappte Spalte fehlt"-Fall (bleibt blockierend).
 *
 * `entscheideDrift` fasst die Regel zusammen und ergänzt die einmalige
 * Nutzer-Zustimmung („Trotzdem importieren"): NUR sie hebt die Blockade auf,
 * und sie benennt dabei, welche Spalten übergangen werden.
 */
import { describe, it, expect } from 'vitest';
import type { CsvSchema, ColumnMapping } from '@/core/services/csv/types';
import {
  validateHeaders,
  hasDrift,
  isNewColumnsOnlyDrift,
  entscheideDrift,
  encodingHeilungTraegt,
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

describe('encodingHeilungTraegt', () => {
  const mk = (missing: string[], neu: string[]): HeaderValidation => ({
    matched: ['AKZ'],
    missingFromCsv: missing,
    newColumns: neu,
  });

  it('der belegte Fall: Umlaut-Spalten fehlen UND stehen als neu da', () => {
    // 12.08.2026, alle drei Quellen der lokalen Kopie: Export von windows-1252
    // auf UTF-8 gewechselt, `Nachrücker` fehlt und `NachrÃ¼cker` ist „neu".
    const vorher = mk(['Nachrücker', 'D_ÄA'], ['NachrÃ¼cker', 'D_Ã„A']);
    const nachher = mk([], []);
    expect(encodingHeilungTraegt(vorher, nachher)).toBe(true);
  });

  it('„etwas besser" reicht NICHT — Restlücke heisst andere Ursache', () => {
    expect(encodingHeilungTraegt(mk(['A', 'B'], []), mk(['A'], []))).toBe(false);
  });

  it('ohne vorherige Luecke gibt es nichts zu heilen', () => {
    // Reine Zusatzspalten laufen ueber den Adopt-Pfad, nicht ueber die Heilung.
    expect(encodingHeilungTraegt(mk([], ['NEU']), mk([], []))).toBe(false);
  });
});

describe('entscheideDrift', () => {
  const mk = (missing: string[], neu: string[]): HeaderValidation => ({
    matched: ['AKZ'],
    missingFromCsv: missing,
    newColumns: neu,
  });

  it('ohne Drift: importieren, nichts adoptieren, nichts uebergangen', () => {
    expect(entscheideDrift(mk([], []), false)).toEqual({
      importieren: true, neueSpaltenAdoptieren: false, uebergangeneSpalten: [],
    });
  });

  it('nur Zusatzspalten: headless adoptieren und importieren — ohne Zustimmung', () => {
    expect(entscheideDrift(mk([], ['NEU']), false)).toEqual({
      importieren: true, neueSpaltenAdoptieren: true, uebergangeneSpalten: [],
    });
  });

  it('fehlende Spalte ohne Zustimmung: blockiert (der Vorher-Zustand)', () => {
    expect(entscheideDrift(mk(['WEG'], []), false)).toEqual({
      importieren: false, neueSpaltenAdoptieren: false, uebergangeneSpalten: [],
    });
    expect(entscheideDrift(mk(['WEG'], ['NEU']), false).importieren).toBe(false);
  });

  it('fehlende Spalte MIT Zustimmung: importiert und benennt die uebergangenen Spalten', () => {
    expect(entscheideDrift(mk(['WEG', 'AUCH_WEG'], []), true)).toEqual({
      importieren: true,
      neueSpaltenAdoptieren: false,
      uebergangeneSpalten: ['WEG', 'AUCH_WEG'],
    });
  });

  it('Zustimmung deckt fehlende UND neue Spalten in einem Zug ab', () => {
    expect(entscheideDrift(mk(['WEG'], ['NEU']), true)).toEqual({
      importieren: true,
      neueSpaltenAdoptieren: true,
      uebergangeneSpalten: ['WEG'],
    });
  });

  it('Zustimmung ohne Drift aendert nichts — sie erfindet keine Meldung', () => {
    expect(entscheideDrift(mk([], []), true).uebergangeneSpalten).toEqual([]);
  });
});
