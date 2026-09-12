/**
 * Zwei Quellspalten auf einem Feld-Key — der stille Datenverlust.
 *
 * Der Anlass ist messbar: `termin_fur_nachlieferung` bekommt im Antrags-Schema
 * sowohl `D_ANT` (das Datum) als auch `T_ANT` (den Text „Termin für
 * Nachlieferung"). Der Text gewinnt, und beide Regeln, die diesen Termin
 * brauchen, trafen auf keinen einzigen von 2.537 gemessenen Vorgängen zu.
 */
import { describe, it, expect } from 'vitest';
import {
  eindeutigerFeldKey, entflechteFeldKeys, findeSpaltenKollisionen, kollisionsSatz,
} from '../spalten-kollisionen';
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

describe('eindeutigerFeldKey', () => {
  it('lässt einen freien Namen unverändert', () => {
    expect(eindeutigerFeldKey('termin', 'D_ANT', new Set())).toBe('termin');
  });

  it('nutzt die Konvention des Fachsystems statt einer Zahl', () => {
    const belegt = new Set(['termin']);
    expect(eindeutigerFeldKey('termin', 'T_ANT', belegt)).toBe('termin_text');
    expect(eindeutigerFeldKey('termin', 'D_ANT', belegt)).toBe('termin_datum');
    expect(eindeutigerFeldKey('pc', 'D_XRN+', new Set(['pc']))).toBe('pc_plus');
    expect(eindeutigerFeldKey('pc', 'D_XRN-', new Set(['pc']))).toBe('pc_minus');
  });

  it('fällt auf den Spaltennamen zurück, wenn auch der Zusatz belegt ist', () => {
    expect(eindeutigerFeldKey('termin', 'T_ANT', new Set(['termin', 'termin_text'])))
      .toBe('termin_t_ant');
  });

  it('zählt erst, wenn kein sprechender Name mehr frei ist', () => {
    const belegt = new Set(['t', 't_text', 't_t_ant']);
    expect(eindeutigerFeldKey('t', 'T_ANT', belegt)).toBe('t_2');
  });
});

describe('entflechteFeldKeys', () => {
  it('gibt der HINTEREN Spalte den neuen Namen — die vordere bekommt ihren Wert zurück', () => {
    const { mapping, umbenannt } = entflechteFeldKeys({
      D_ANT: { custom: 'termin_fur_nachlieferung', type: 'date', label: 'Termin für Nachlieferung' },
      T_ANT: { custom: 'termin_fur_nachlieferung', type: 'string', label: 'Termin für Nachlieferung' },
    });
    expect(mapping.D_ANT?.custom).toBe('termin_fur_nachlieferung');
    expect(mapping.T_ANT?.custom).toBe('termin_fur_nachlieferung_text');
    expect(umbenannt).toEqual([
      { spalte: 'T_ANT', von: 'termin_fur_nachlieferung', nach: 'termin_fur_nachlieferung_text' },
    ]);
  });

  it('trennt Zusage und Verneinung (D_XRN+ / D_XRN-)', () => {
    const { mapping } = entflechteFeldKeys({
      'D_XRN+': { custom: 'nw_partner', type: 'date' },
      'D_XRN-': { custom: 'nw_partner', type: 'string' },
    });
    expect(mapping['D_XRN+']?.custom).toBe('nw_partner');
    expect(mapping['D_XRN-']?.custom).toBe('nw_partner_minus');
  });

  it('löst auch drei Spalten auf einem Feld', () => {
    const { mapping } = entflechteFeldKeys({
      PLZ_AFS: { custom: 'ausfuhrende_stelle', type: 'number' },
      ORT_AFS: { custom: 'ausfuhrende_stelle', type: 'string' },
      BULAND_AFS: { custom: 'ausfuhrende_stelle', type: 'string' },
    });
    const keys = Object.values(mapping).map(e => e.custom);
    expect(new Set(keys).size).toBe(3);
    expect(keys[0]).toBe('ausfuhrende_stelle');
  });

  it('lässt ein sauberes Mapping Byte für Byte in Ruhe', () => {
    const sauber = {
      D_AAI: { custom: 'antragsimport', type: 'string' as const },
      T_AAI: { custom: 'vorgangscode', type: 'string' as const },
    };
    const { mapping, umbenannt } = entflechteFeldKeys(sauber);
    expect(umbenannt).toEqual([]);
    expect(mapping).toEqual(sauber);
  });

  it('fasst Standardfelder nicht an — sie sind das Schema der App, keine Ableitung', () => {
    const { mapping, umbenannt } = entflechteFeldKeys({
      FKZ: { canonical: 'aktenzeichen', type: 'string' },
      AKZ: { canonical: 'aktenzeichen', type: 'string' },
    });
    expect(umbenannt).toEqual([]);
    expect(mapping.AKZ?.canonical).toBe('aktenzeichen');
  });

  it('überspringt ignorierte Spalten, statt ihnen einen Namen zu geben', () => {
    const { mapping, umbenannt } = entflechteFeldKeys({
      D_ANT: { custom: 'termin', type: 'date' },
      T_ANT: { custom: 'termin', type: 'string', ignore: true },
    });
    expect(umbenannt).toEqual([]);
    expect(mapping.T_ANT?.custom).toBe('termin');
  });

  /** Nach dem Entflechten darf `findeSpaltenKollisionen` nichts mehr finden. */
  it('ist die Umkehrung des Finders', () => {
    const roh = {
      D_ANT: { custom: 'termin', type: 'date' as const },
      T_ANT: { custom: 'termin', type: 'string' as const },
      D_ADS: { custom: 'fkz_ds', type: 'string' as const },
      T_ADS: { custom: 'fkz_ds', type: 'string' as const },
      'D_XRN+': { custom: 'nw', type: 'date' as const },
      'D_XRN-': { custom: 'nw', type: 'string' as const },
    };
    expect(findeSpaltenKollisionen(schema(roh))).toHaveLength(3);
    const { mapping } = entflechteFeldKeys(roh);
    expect(findeSpaltenKollisionen(schema(mapping))).toEqual([]);
  });
});
