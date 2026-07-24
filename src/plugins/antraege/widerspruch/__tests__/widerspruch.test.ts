/**
 * Reine Widerspruchs-Logik: Zustands-/Notiz-Mutationen, offene Gründe, Antwort-Tor.
 */
import { describe, it, expect } from 'vitest';
import {
  antwortTorErfuellt, notizVon, offeneWiderspruchKeys, setzeNotiz, setzeZustand, zustandVon,
} from '../widerspruch';
import type { WiderspruchRecord } from '../types';

const REC = (punkte: WiderspruchRecord['punkte']): WiderspruchRecord => ({ verbundAz: 'V1', punkte, schemaVersion: 1 });

describe('Zustands-/Notiz-Mutationen', () => {
  it('legt einen Punkt an, wenn er neu ist', () => {
    const p = setzeZustand([], 'k1', 'ausgeraeumt');
    expect(p).toEqual([{ punktKey: 'k1', zustand: 'ausgeraeumt', notiz: '' }]);
  });

  it('aktualisiert einen bestehenden Punkt, ohne die Notiz zu verlieren', () => {
    const p = setzeNotiz(setzeZustand([], 'k1', 'teilweise'), 'k1', 'Kommentar');
    expect(p).toEqual([{ punktKey: 'k1', zustand: 'teilweise', notiz: 'Kommentar' }]);
    const p2 = setzeZustand(p, 'k1', 'nicht_ausgeraeumt');
    expect(p2[0]).toEqual({ punktKey: 'k1', zustand: 'nicht_ausgeraeumt', notiz: 'Kommentar' });
  });

  it('liest Zustand/Notiz mit Defaults', () => {
    const rec = REC([{ punktKey: 'k1', zustand: 'teilweise', notiz: 'x' }]);
    expect(zustandVon(rec, 'k1')).toBe('teilweise');
    expect(zustandVon(rec, 'kX')).toBe('offen');
    expect(notizVon(rec, 'k1')).toBe('x');
    expect(notizVon(null, 'k1')).toBe('');
  });
});

describe('offeneWiderspruchKeys', () => {
  it('nennt alles außer den ausgeräumten Gründen', () => {
    const rec = REC([
      { punktKey: 'a', zustand: 'ausgeraeumt', notiz: '' },
      { punktKey: 'b', zustand: 'teilweise', notiz: '' },
      { punktKey: 'c', zustand: 'nicht_ausgeraeumt', notiz: '' },
    ]);
    // d ist unbewertet (offen) → zählt als offen
    expect(offeneWiderspruchKeys(rec, ['a', 'b', 'c', 'd'])).toEqual(['b', 'c', 'd']);
  });

  it('zählt ohne Record alle als offen', () => {
    expect(offeneWiderspruchKeys(null, ['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('antwortTorErfuellt', () => {
  it('verlangt, dass jeder offene Grund adressiert ist', () => {
    expect(antwortTorErfuellt(['a', 'b'], new Set(['a', 'b', 'c']))).toBe(true);
    expect(antwortTorErfuellt(['a', 'b'], new Set(['a']))).toBe(false);
    expect(antwortTorErfuellt([], new Set())).toBe(true);
  });
});
