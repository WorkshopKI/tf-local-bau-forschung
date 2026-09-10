import { describe, it, expect } from 'vitest';
import { baueQuellSpaltenIndex } from '@/core/services/csv/spalten-inventar';
import type { CsvSchema } from '@/core/services/csv/types';
import { bedingungSatz, type Bedingung } from '@/core/status';
import { bedingungQuellen, feldQuellen } from '@/core/status/bedingung-quellen';

function schema(id: string, programmId: string, mapping: CsvSchema['column_mapping']): CsvSchema {
  return {
    id, programm_id: programmId, csv_source_name: `${id}.csv`, is_master: true,
    join_key: 'aktenzeichen', priority: 1, column_mapping: mapping,
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

const index = baueQuellSpaltenIndex([
  schema('S1', 'zim', {
    D_AAE: { canonical: 'antragsdatum', type: 'date', label: 'Antrags\r\neingang' },
    TIB_KUERZ: { canonical: 'tib_kuerz', label: 'TIB' },
    BIB_KUERZ: { canonical: 'bib_kuerz', label: 'BIB' },
    D_XTE: { custom: 'alle_an_trage_da', type: 'date', label: 'alle Anträge da' },
  }),
  schema('S2', 'igf', {
    EINGANG: { canonical: 'antragsdatum', type: 'date', label: 'Eingang' },
  }),
]);

/** Die Namen, wie die Fassung sie führt — der Satz daneben benutzt dieselben. */
const namen = (id: string): string => ({ tib_kuerz: 'TIB', bib_kuerz: 'BIB' } as Record<string, string>)[id] ?? id;

describe('bedingungQuellen', () => {
  const tibUndBib: Bedingung = {
    alle: [{ feldId: 'tib_kuerz', op: 'gefuellt' }, { feldId: 'bib_kuerz', op: 'gefuellt' }],
  };

  it('nimmt als Satz genau den sichtbaren Bedingungstext', () => {
    expect(bedingungQuellen(tibUndBib, index, namen).satz).toBe(bedingungSatz(tibUndBib, namen));
  });

  it('nennt je Feld seine Quellspalten, gruppiert nach dem Feld', () => {
    expect(bedingungQuellen(tibUndBib, index, namen).felder).toEqual([
      { code: 'TIB_KUERZ', label: 'TIB', fuer: 'TIB (tib_kuerz)' },
      { code: 'BIB_KUERZ', label: 'BIB', fuer: 'BIB (bib_kuerz)' },
    ]);
  });

  it('meldet ein Programm, das die Felder nicht mappt', () => {
    expect(bedingungQuellen(tibUndBib, index, namen).hinweis).toContain('TIB: igf');
  });

  it('erfasst bei datumNachFeld beide Felder', () => {
    const b: Bedingung = { feldId: 'D_XTE', op: 'datumNachFeld', vergleichFeldId: 'antragsdatum' };
    expect(bedingungQuellen(b, index, namen).felder.map(f => f.code)).toEqual(['D_XTE', 'D_AAE', 'EINGANG']);
  });

  it('sagt, wenn ein Feld keine Quellspalte hat, statt es wegzulassen', () => {
    const b: Bedingung = { feldId: 'verbund_status', op: 'gefuellt' };
    const e = bedingungQuellen(b, index, namen);
    expect(e.felder).toEqual([]);
    expect(e.hinweis).toContain('Keine CSV-Spalte gefunden für verbund_status');
  });
});

describe('feldQuellen', () => {
  it('benennt ohne eigenen Auflöser nach dem Schema-Label, einzeilig', () => {
    const e = feldQuellen(['antragsdatum'], index, 'Anker');
    expect(e.felder[0]).toEqual({ code: 'D_AAE', label: 'Antrags eingang', fuer: 'Antrags eingang (antragsdatum)' });
    expect(e.hinweis).toBeUndefined();
  });

  it('reicht eine Regel durch', () => {
    expect(feldQuellen(['antragsdatum'], index, 'Anker', { regel: 'das spätere' }).regel).toBe('das spätere');
  });
});
