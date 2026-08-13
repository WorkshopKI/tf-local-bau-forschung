import { describe, it, expect } from 'vitest';
import { verschiebeUmEinen } from '../laneFolge';

describe('verschiebeUmEinen — die Rechnung hinter dem Pfeilpaar der LaneListe', () => {
  const liste = ['a', 'b', 'c'];

  it('tauscht mit dem Nachbarn in beide Richtungen', () => {
    expect(verschiebeUmEinen(liste, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(verschiebeUmEinen(liste, 1, 1)).toEqual(['a', 'c', 'b']);
  });

  it('gibt am Rand DIESELBE Referenz zurück (der Aufrufer spart den Schreibvorgang)', () => {
    expect(verschiebeUmEinen(liste, 0, -1)).toBe(liste);
    expect(verschiebeUmEinen(liste, 2, 1)).toBe(liste);
  });

  it('unbekannter Platz (findIndex → −1) bleibt folgenlos', () => {
    expect(verschiebeUmEinen(liste, -1, 1)).toBe(liste);
    expect(verschiebeUmEinen(liste, 9, -1)).toBe(liste);
  });

  it('lässt die Eingabe unangetastet (splice arbeitet auf der Kopie)', () => {
    verschiebeUmEinen(liste, 1, -1);
    expect(liste).toEqual(['a', 'b', 'c']);
  });
});
