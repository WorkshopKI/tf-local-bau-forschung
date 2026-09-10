import { describe, it, expect } from 'vitest';
import { baueAnkerLeser } from '@/core/meilensteine/anker';
import type { CsvSchema } from '@/core/services/csv/types';

function schema(mapping: CsvSchema['column_mapping']): CsvSchema {
  return {
    id: 'S1', programm_id: 'P1', csv_source_name: 'test.csv', is_master: true,
    join_key: 'aktenzeichen', priority: 1, column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

/** Wie im produktiven Master-Schema: `D_XTE` custom unter `alle_an_trage_da`. */
const MIT_XTE = schema({
  D_AAE: { canonical: 'antragsdatum', type: 'date', label: 'Antrags\r\neingang' },
  D_XTE: { custom: 'alle_an_trage_da', type: 'date', label: 'alle Anträge da' },
});

describe('baueAnkerLeser', () => {
  it('nimmt je TV das spätere aus D_AAE und D_XTE, im Verbund das späteste', () => {
    const anker = baueAnkerLeser([MIT_XTE]);
    expect(anker([
      { antragsdatum: '2026-01-05', alle_an_trage_da: '2026-01-20' },
      { antragsdatum: '2026-01-12' },
    ])).toBe('2026-01-20');
  });

  it('bleibt beim Antragsdatum, wenn es später liegt als „alle Anträge da"', () => {
    expect(baueAnkerLeser([MIT_XTE])([
      { antragsdatum: '2026-03-01', alle_an_trage_da: '2026-02-01' },
    ])).toBe('2026-03-01');
  });

  it('liest D_XTE unter dem Record-Key, den das Schema nennt — nicht unter einem geratenen', () => {
    // `d_xte` und `alle_antraege_da` wären plausible Namen, sind hier aber nicht
    // gemappt. Wer sie liest, rät (recurring-bug-classes Klasse 5).
    expect(baueAnkerLeser([MIT_XTE])([
      { antragsdatum: '2026-01-05', d_xte: '2026-02-01', alle_antraege_da: '2026-02-01' },
    ])).toBe('2026-01-05');
  });

  it('versteht das deutsche Datumsformat', () => {
    expect(baueAnkerLeser([MIT_XTE])([
      { antragsdatum: '2026-01-05', alle_an_trage_da: '20.01.2026' },
    ])).toBe('2026-01-20');
  });

  it('fällt ohne gemapptes D_XTE auf das Antragsdatum zurück', () => {
    const ohne = schema({ D_AAE: { canonical: 'antragsdatum', type: 'date' } });
    expect(baueAnkerLeser([ohne])([
      { antragsdatum: '2026-01-05', alle_an_trage_da: '2026-02-01' },
    ])).toBe('2026-01-05');
  });

  it('ignoriert leere und unlesbare Werte', () => {
    const anker = baueAnkerLeser([MIT_XTE]);
    expect(anker([{ antragsdatum: '2026-01-05', alle_an_trage_da: 'kaputt' }])).toBe('2026-01-05');
    expect(anker([{ antragsdatum: '', alle_an_trage_da: '' }])).toBeNull();
    expect(anker([])).toBeNull();
  });
});
