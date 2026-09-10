import { describe, it, expect } from 'vitest';
import {
  baueQuellSpaltenIndex, baueSpaltenKatalog, rohSpaltenJeFeld,
} from '@/core/services/csv/spalten-inventar';
import type { CsvSchema } from '@/core/services/csv/types';

function schema(id: string, programmId: string, mapping: CsvSchema['column_mapping']): CsvSchema {
  return {
    id, programm_id: programmId, csv_source_name: `${id}.csv`, is_master: true,
    join_key: 'aktenzeichen', priority: 1, column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const ZIM = schema('S1', 'zim', {
  D_AAE: { canonical: 'antragsdatum', type: 'date', label: 'Antrags\r\neingang' },
  TIB_KUERZ: { canonical: 'tib_kuerz', label: 'TIB' },
  D_XTE: { custom: 'alle_an_trage_da', type: 'date', label: 'alle An-träge da' },
  ALT: { canonical: 'titel', ignore: true },
});
const IGF = schema('S2', 'igf', {
  EINGANG: { canonical: 'antragsdatum', type: 'date', label: 'Eingang' },
});

describe('baueQuellSpaltenIndex', () => {
  const index = baueQuellSpaltenIndex([ZIM, IGF]);

  it('löst einen kanonischen Key zu allen Spalten auf, die ihn speisen', () => {
    expect(index.quellSpaltenVon('antragsdatum')).toEqual({
      spalten: [{ code: 'D_AAE', label: 'Antrags\r\neingang' }, { code: 'EINGANG', label: 'Eingang' }],
      fehltIn: [],
    });
  });

  it('nennt die Programme, die ein Feld nicht mappen', () => {
    expect(index.quellSpaltenVon('tib_kuerz')).toEqual({
      spalten: [{ code: 'TIB_KUERZ', label: 'TIB' }], fehltIn: ['igf'],
    });
  });

  it('löst einen Custom-Key auf', () => {
    expect(index.quellSpaltenVon('alle_an_trage_da').spalten.map(s => s.code)).toEqual(['D_XTE']);
  });

  it('löst einen rohen Spalten-Code in jeder Schreibweise auf — auch einen kanonisch gemappten', () => {
    expect(index.quellSpaltenVon('D_XTE').spalten.map(s => s.code)).toEqual(['D_XTE']);
    expect(index.quellSpaltenVon('d-xte').spalten.map(s => s.code)).toEqual(['D_XTE']);
    expect(index.quellSpaltenVon('D_AAE').spalten.map(s => s.code)).toEqual(['D_AAE']);
  });

  it('liefert für ein unbekanntes oder ignoriertes Feld keine Spalte — und keine erfundene Lücke', () => {
    expect(index.quellSpaltenVon('gibt_es_nicht')).toEqual({ spalten: [], fehltIn: [] });
    expect(index.quellSpaltenVon('titel')).toEqual({ spalten: [], fehltIn: [] });
    expect(index.quellSpaltenVon('ALT')).toEqual({ spalten: [], fehltIn: [] });
  });

  it('labelVon macht aus dem Schema-Label eine Zeile, sonst bleibt die feldId', () => {
    expect(index.labelVon('antragsdatum')).toBe('Antrags eingang');
    expect(index.labelVon('gibt_es_nicht')).toBe('gibt_es_nicht');
  });

  it('kennt die Programme sortiert', () => {
    expect(index.programme).toEqual(['igf', 'zim']);
  });
});

describe('rohSpaltenJeFeld (Projektion desselben Durchgangs)', () => {
  it('führt kanonische und Custom-Keys, je Code einmal, das erste Label gewinnt', () => {
    const doppelt = schema('S3', 'zim', { D_AAE: { canonical: 'antragsdatum', type: 'date', label: 'anders' } });
    const roh = rohSpaltenJeFeld([ZIM, IGF, doppelt]);
    expect(roh.get('antragsdatum')).toEqual([
      { code: 'D_AAE', label: 'Antrags\r\neingang' }, { code: 'EINGANG', label: 'Eingang' },
    ]);
    expect(roh.get('alle_an_trage_da')).toEqual([{ code: 'D_XTE', label: 'alle An-träge da' }]);
    // Rohe Codes gehören in den Index, nicht in diese Karte — ihre Leser
    // fragen nur nach projizierten Feldern.
    expect(roh.has('D_XTE')).toBe(false);
    expect(roh.has('titel')).toBe(false);
  });
});

describe('baueSpaltenKatalog — quellSpalten', () => {
  it('trägt die Quellspalten mit Beschriftung, bei rohen Spalten die Spalte selbst', () => {
    const katalog = baueSpaltenKatalog([ZIM, IGF]);
    expect(katalog.find(e => e.feldId === 'antragsdatum')?.quellSpalten?.map(s => s.code))
      .toEqual(['D_AAE', 'EINGANG']);
    expect(katalog.find(e => e.feldId === 'D_XTE')?.quellSpalten)
      .toEqual([{ code: 'D_XTE', label: 'alle An-träge da' }]);
  });
});
