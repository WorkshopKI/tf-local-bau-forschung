import { describe, it, expect } from 'vitest';
import { toAntragListItem } from '../list-view';
import { LIST_VIEW_FIELDS } from '../constants';
import type { Antrag } from '../types';

function makeAntrag(extra: Record<string, unknown>): Antrag {
  return {
    aktenzeichen: '16KN0001',
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: '2026-01-01T10:00:00Z',
    ...extra,
  } as Antrag;
}

describe('toAntragListItem', () => {
  it('uebernimmt Pflichtfelder', () => {
    const it1 = toAntragListItem(makeAntrag({}));
    expect(it1.aktenzeichen).toBe('16KN0001');
    expect(it1.programm_id).toBe('p1');
    expect(it1._updated_at).toBe('2026-01-01T10:00:00Z');
  });

  it('uebernimmt alle Whitelist-Strings', () => {
    const a = makeAntrag({
      titel: 'Mein Projekt',
      akronym: 'MP',
      status: 'eingereicht',
      antragsteller: 'Inst XY',
      branche: 'Bau',
      frist_datum: '2026-06-01',
      bewilligung_datum: '2025-11-01',
      erstentscheidung: '2025-10-20',
      antragsdatum: '2025-09-15',
      foerdergeber: 'Bund',
      verbund_id: 'V42',
      unterprogramm_id: '4711',
      tib_kuerz: 'MUE',
      bib_kuerz: 'SCH',
      ztp_kuerz: 'AM',
      pfm_kuerz: 'KA',
    });
    const it2 = toAntragListItem(a);
    expect(it2.titel).toBe('Mein Projekt');
    expect(it2.akronym).toBe('MP');
    expect(it2.status).toBe('eingereicht');
    expect(it2.antragsteller).toBe('Inst XY');
    expect(it2.branche).toBe('Bau');
    expect(it2.frist_datum).toBe('2026-06-01');
    expect(it2.bewilligung_datum).toBe('2025-11-01');
    expect(it2.erstentscheidung).toBe('2025-10-20');
    expect(it2.antragsdatum).toBe('2025-09-15');
    expect(it2.foerdergeber).toBe('Bund');
    expect(it2.verbund_id).toBe('V42');
    expect(it2.unterprogramm_id).toBe('4711');
    expect(it2.tib_kuerz).toBe('MUE');
    expect(it2.bib_kuerz).toBe('SCH');
    expect(it2.ztp_kuerz).toBe('AM');
    expect(it2.pfm_kuerz).toBe('KA');
  });

  it('verwirft non-string Werte (number/null/undefined)', () => {
    const a = makeAntrag({
      titel: 42,
      akronym: null,
      status: undefined,
      antragsteller: ['array'],
    });
    const it3 = toAntragListItem(a);
    expect(it3.titel).toBeUndefined();
    expect(it3.akronym).toBeUndefined();
    expect(it3.status).toBeUndefined();
    expect(it3.antragsteller).toBeUndefined();
  });

  it('verwirft leere Strings', () => {
    const a = makeAntrag({ titel: '', akronym: '   ' });
    const it4 = toAntragListItem(a);
    expect(it4.titel).toBeUndefined();
    // Whitespace-only strings sind technisch length>0 — wir lassen sie
    // bewusst durch (entspricht dem Antrag-Verhalten); applyFilters/UI
    // muessen das selbst trimmen wenn relevant.
    expect(it4.akronym).toBe('   ');
  });

  it('verwirft Custom-Felder, die nicht in LIST_VIEW_FIELDS sind', () => {
    const a = makeAntrag({
      foerdersumme_geplant: '1500000',
      irgendein_anderes_feld: 'wert',
      titel: 'Behalten',
    });
    const it5 = toAntragListItem(a);
    expect(it5.titel).toBe('Behalten');
    expect((it5 as unknown as Record<string, unknown>).foerdersumme_geplant).toBeUndefined();
    expect((it5 as unknown as Record<string, unknown>).irgendein_anderes_feld).toBeUndefined();
  });

  it('LIST_VIEW_FIELDS enthaelt alle Pflicht-Whitelist-Keys', () => {
    expect(LIST_VIEW_FIELDS).toContain('aktenzeichen');
    expect(LIST_VIEW_FIELDS).toContain('programm_id');
    expect(LIST_VIEW_FIELDS).toContain('_updated_at');
    expect(LIST_VIEW_FIELDS).toContain('titel');
    expect(LIST_VIEW_FIELDS).toContain('frist_datum');
    expect(LIST_VIEW_FIELDS).toContain('tib_kuerz');
  });
});
