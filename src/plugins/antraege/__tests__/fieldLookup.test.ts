/**
 * Feld-Lookup über CSV-Custom-Keys — reine Logik.
 *
 * `findFieldValueAcross` deckt den Verbund-Fall ab: ein auf Verbund-Ebene
 * gedachtes Feld (VB_INHALT) ist im Export oft nur an EINEM Teilvorhaben gefüllt.
 */
import { describe, it, expect } from 'vitest';
import type { Antrag } from '@/core/services/csv/types';
import { findFieldValue, findFieldValueAcross } from '../fieldLookup';

function tv(extra?: Record<string, unknown>): Antrag {
  return { aktenzeichen: 'AZ', programm_id: 'P', status: 'beantragt', ...extra } as Antrag;
}

describe('findFieldValue — trenner-/case-tolerantes Lookup', () => {
  it('matcht über Separatoren + Casing hinweg', () => {
    expect(findFieldValue(tv({ 'vb inhalt': 'X' }), ['vb_inhalt'])).toBe('X');
    expect(findFieldValue(tv({ Vb_Inhalt: 'Y' }), ['vb inhalt'])).toBe('Y');
  });
  it('ignoriert interne Keys (`_`-Präfix) und liefert sonst undefined', () => {
    expect(findFieldValue(tv({ _vb_inhalt: 'Z' }), ['vb_inhalt'])).toBeUndefined();
    expect(findFieldValue(tv(), ['vb_inhalt'])).toBeUndefined();
  });
});

describe('findFieldValueAcross — erster nicht-leerer Treffer über TVs', () => {
  it('nimmt den Wert vom Partner-TV, wenn der Lead das Feld leer hat', () => {
    const tvs = [tv({ vb_inhalt: '   ' }), tv({ vb_inhalt: 'Abstract vom Partner' })];
    expect(findFieldValueAcross(tvs, ['vb_inhalt'])).toBe('Abstract vom Partner');
  });
  it('bevorzugt das erste gefüllte TV (stabile Reihenfolge)', () => {
    const tvs = [tv({ vb_inhalt: 'erster' }), tv({ vb_inhalt: 'zweiter' })];
    expect(findFieldValueAcross(tvs, ['vb_inhalt'])).toBe('erster');
  });
  it('überspringt leere Strings und liefert undefined, wenn nirgends gefüllt', () => {
    expect(findFieldValueAcross([tv({ vb_inhalt: '' }), tv()], ['vb_inhalt'])).toBeUndefined();
    expect(findFieldValueAcross([], ['vb_inhalt'])).toBeUndefined();
  });
});
