/**
 * Zwei Quellspalten auf einem Feld-Key — der stille Datenverlust.
 *
 * Der Anlass ist messbar: `termin_fur_nachlieferung` bekommt im Antrags-Schema
 * sowohl `D_ANT` (das Datum) als auch `T_ANT` (den Text „Termin für
 * Nachlieferung"). Der Text gewinnt, und beide Regeln, die diesen Termin
 * brauchen, trafen auf keinen einzigen von 2.537 gemessenen Vorgängen zu.
 */
import { describe, it, expect } from 'vitest';
import { findeSpaltenKollisionen, kollisionsSatz } from '../spalten-kollisionen';
import type { ColumnMapping, CsvSchema } from '../types';

function schema(column_mapping: ColumnMapping): CsvSchema {
  return {
    id: 's1',
    programm_id: 'p1',
    csv_source_name: 'test.csv',
    is_master: true,
    priority: 1,
    join_key: 'aktenzeichen',
    column_mapping,
    created_at: '2026-09-12T00:00:00.000Z',
    _updated_at: '2026-09-12T00:00:00.000Z',
  } as CsvSchema;
}

describe('findeSpaltenKollisionen', () => {
  it('findet den ANT-Fall: Datum und Text teilen sich ein Feld', () => {
    const k = findeSpaltenKollisionen(schema({
      D_ANT: { custom: 'termin_fur_nachlieferung', type: 'date', label: 'Termin für Nachlieferung' },
      T_ANT: { custom: 'termin_fur_nachlieferung', type: 'string', label: 'Termin für Nachlieferung' },
    }));
    expect(k).toHaveLength(1);
    expect(k[0]?.feldKey).toBe('termin_fur_nachlieferung');
    expect(k[0]?.spalten.map(s => s.spalte)).toEqual(['D_ANT', 'T_ANT']);
    expect(k[0]?.typenGemischt).toBe(true);
  });

  it('nennt im Satz die Spalte, die gewinnt, und die, deren Wert fehlt', () => {
    const k = findeSpaltenKollisionen(schema({
      D_ANT: { custom: 'termin', type: 'date' },
      T_ANT: { custom: 'termin', type: 'string' },
    }));
    expect(kollisionsSatz(k[0]!))
      .toBe('„termin" wird von 2 Spalten beschrieben — T_ANT (string) überschreibt D_ANT (date).');
  });

  it('meldet auch drei Spalten auf einem Feld (Adresse: PLZ + Ort + Bundesland)', () => {
    const k = findeSpaltenKollisionen(schema({
      PLZ_AFS: { custom: 'ausfuhrende_stelle', type: 'number' },
      ORT_AFS: { custom: 'ausfuhrende_stelle', type: 'string' },
      BULAND_AFS: { custom: 'ausfuhrende_stelle', type: 'string' },
    }));
    expect(k[0]?.spalten).toHaveLength(3);
    expect(kollisionsSatz(k[0]!)).toContain('BULAND_AFS (string) überschreibt PLZ_AFS (number), ORT_AFS (string)');
  });

  it('zählt ignorierte Spalten nicht mit — sie werden gar nicht geschrieben', () => {
    expect(findeSpaltenKollisionen(schema({
      D_ANT: { custom: 'termin', type: 'date' },
      T_ANT: { custom: 'termin', type: 'string', ignore: true },
    }))).toEqual([]);
  });

  it('lässt saubere Mappings in Ruhe — auch ein D_/T_-Paar mit zwei Schlüsseln', () => {
    expect(findeSpaltenKollisionen(schema({
      D_AAI: { custom: 'antragsimport_aus_zim_foyer', type: 'string' },
      T_AAI: { custom: 'zim_foyer_vorgangscode', type: 'string' },
    }))).toEqual([]);
  });

  it('erkennt die Kollision auch ohne `custom` — dann ist der Spaltenname der Schlüssel', () => {
    // `resolveFieldKey` fällt auf `col.toLowerCase()` zurück; zwei Spalten, die
    // sich nur in der Groß-/Kleinschreibung unterscheiden, landen auf einem Feld.
    const k = findeSpaltenKollisionen(schema({
      Status: { type: 'string' },
      STATUS: { type: 'string' },
    }));
    expect(k[0]?.feldKey).toBe('status');
  });

  it('stellt gemischte Typen nach vorn — dort ist der Verlust mechanisch wirksam', () => {
    const k = findeSpaltenKollisionen(schema({
      A1: { custom: 'zzz_gemischt', type: 'date' },
      A2: { custom: 'zzz_gemischt', type: 'string' },
      B1: { custom: 'aaa_gleich', type: 'string' },
      B2: { custom: 'aaa_gleich', type: 'string' },
    }));
    expect(k.map(x => x.feldKey)).toEqual(['zzz_gemischt', 'aaa_gleich']);
    expect(k[1]?.typenGemischt).toBe(false);
  });

  it('liefert für ein leeres Mapping eine leere Liste', () => {
    expect(findeSpaltenKollisionen(schema({}))).toEqual([]);
  });
});
