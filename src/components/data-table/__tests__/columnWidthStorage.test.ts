/**
 * Persistenz der Spaltenbreiten.
 *
 * Der interessante Teil ist `entferneBreite`: der Doppelklick auf den
 * Spaltengriff muss den Eintrag LÖSCHEN, nicht überschreiben — sonst erstarrt
 * die Spalte bei der Breite von damals, statt wieder dem Inhalt zu folgen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ladeBreiten, speichereBreiten, entferneBreite } from '../columnWidthStorage';

const KEY = 'test_col_widths';

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  });
});

describe('entferneBreite', () => {
  it('löscht genau einen Schlüssel', () => {
    expect(entferneBreite({ a: 100, b: 200 }, 'a')).toEqual({ b: 200 });
  });

  it('lässt die Map unangetastet, wenn der Schlüssel gar nicht drin ist', () => {
    const vorher = { a: 100 };
    expect(entferneBreite(vorher, 'b')).toBe(vorher);
  });

  it('mutiert die Eingabe nicht', () => {
    const vorher = { a: 100, b: 200 };
    entferneBreite(vorher, 'a');
    expect(vorher).toEqual({ a: 100, b: 200 });
  });

  it('darf keinen Nullwert hinterlassen — sonst gälte er als Override', () => {
    const nachher = entferneBreite({ a: 100 }, 'a');
    expect('a' in nachher).toBe(false);
  });
});

describe('ladeBreiten', () => {
  it('liefert die Defaults, wenn nichts gespeichert ist', () => {
    expect(ladeBreiten(KEY, { a: 120 })).toEqual({ a: 120 });
  });

  it('überlagert die Defaults mit dem Gespeicherten', () => {
    speichereBreiten(KEY, { a: 300 });
    expect(ladeBreiten(KEY, { a: 120, b: 90 })).toEqual({ a: 300, b: 90 });
  });

  it('fällt bei kaputtem JSON auf die Defaults zurück statt zu werfen', () => {
    localStorage.setItem(KEY, '{ nicht wirklich json');
    expect(ladeBreiten(KEY, { a: 120 })).toEqual({ a: 120 });
  });

  it('ignoriert unbrauchbare Werte (0, negativ, Text, null)', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 0, b: -5, c: 'breit', d: null, e: 200 }));
    expect(ladeBreiten(KEY, {})).toEqual({ e: 200 });
  });

  it('nimmt ein Array nicht als Breiten-Map an', () => {
    localStorage.setItem(KEY, JSON.stringify([1, 2, 3]));
    expect(ladeBreiten(KEY, { a: 120 })).toEqual({ a: 120 });
  });

  it('Roundtrip: speichern und laden liefert dasselbe', () => {
    speichereBreiten(KEY, { a: 140, b: 300 });
    expect(ladeBreiten(KEY, {})).toEqual({ a: 140, b: 300 });
  });
});
