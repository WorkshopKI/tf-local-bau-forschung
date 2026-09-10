import { describe, it, expect } from 'vitest';
import { baueQuellSpaltenIndex } from '@/core/services/csv/spalten-inventar';
import type { CsvSchema } from '@/core/services/csv/types';
import { knotenQuellen, knotenRegel } from '@/core/meilensteine/quellen';
import type { MeilensteinKnoten } from '@/core/meilensteine/typen';

const index = baueQuellSpaltenIndex([{
  id: 'S1', programm_id: 'zim', csv_source_name: 'zim.csv', is_master: true,
  join_key: 'aktenzeichen', priority: 1, created_at: '2026-01-01T00:00:00.000Z',
  column_mapping: {
    TIB_KUERZ: { canonical: 'tib_kuerz', label: 'TIB' },
    BIB_KUERZ: { canonical: 'bib_kuerz', label: 'BIB' },
    D_XTE: { custom: 'alle_an_trage_da', type: 'date', label: 'alle Anträge da' },
  },
} satisfies CsvSchema]);

function knoten(p: Partial<MeilensteinKnoten>): MeilensteinKnoten {
  return {
    id: 'k', elternId: null, nummer: '3', label: 'Antrag zugewiesen', sollWoche: 2,
    relevantFuerFrist: true, nurTypen: [], aktiv: true, sortierung: 10,
    bedingung: { alle: [{ feldId: 'tib_kuerz', op: 'gefuellt' }, { feldId: 'bib_kuerz', op: 'gefuellt' }] },
    ...p,
  };
}

describe('knotenQuellen', () => {
  it('nennt Bedingung und Ist-Termin-Feld mit ihren Quellspalten', () => {
    const e = knotenQuellen(knoten({ istDatumFeld: 'D_XTE' }), index);
    expect(e.satz.startsWith('Antrag zugewiesen: ')).toBe(true);
    expect(e.felder.map(f => f.code)).toEqual(['TIB_KUERZ', 'BIB_KUERZ', 'D_XTE']);
  });

  it('erklärt, wie aus den Teilvorhaben der Verbund-Wert wird', () => {
    const k = knoten({ istDatumFeld: 'D_XTE' });
    expect(knotenQuellen(k, index).regel).toBe(knotenRegel(k));
    expect(knotenRegel(k)).toContain('sobald ein Teilvorhaben');
    expect(knotenRegel(k)).toContain('Ist-Termin-Feldes');
    expect(knotenRegel(knoten({}))).toContain('früheste Datum der Bedingungsfelder');
  });

  it('sagt bei einem Knoten ohne Bedingung, dass er über die Unter-Meilensteine läuft', () => {
    const e = knotenQuellen(knoten({ bedingung: { einige: [] } }), index);
    expect(e.satz).toContain('ohne eigene Bedingung');
    expect(e.regel).toBeUndefined();
  });
});
