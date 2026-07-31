import { describe, expect, it } from 'vitest';
import {
  merkeAnweisung, ANWEISUNG_MAX_LAENGE, MAX_ANWEISUNGEN,
} from '../anweisungVerlauf';

const A = 'Technische Risiken auf die des Lösungswegs beschränken.';
const B = 'Details des Lösungsweges vertiefen.';

describe('merkeAnweisung', () => {
  it('reiht neu vorne ein und lässt die Eingabe-Liste unberührt', () => {
    const bisher = [B];
    const next = merkeAnweisung(bisher, A);
    expect(next).toEqual([A, B]);
    expect(bisher).toEqual([B]);
  });

  it('trimmt und ignoriert leere/whitespace Eingaben', () => {
    expect(merkeAnweisung([B], `  ${A} `)).toEqual([A, B]);
    expect(merkeAnweisung([B], '   \n ')).toEqual([B]);
    expect(merkeAnweisung([], '')).toEqual([]);
  });

  it('zieht einen erneut genutzten Wortlaut nach vorn statt ihn zu doppeln', () => {
    const next = merkeAnweisung(['x', A, 'y'], A);
    expect(next).toEqual([A, 'x', 'y']);
  });

  it('erkennt Wiederholungen case-insensitiv und mit Rand-Whitespace', () => {
    const next = merkeAnweisung([`  ${A.toUpperCase()}  `, 'x'], A);
    expect(next).toEqual([A, 'x']);
  });

  it(`kappt die Liste auf ${MAX_ANWEISUNGEN} (älteste fliegt raus)`, () => {
    const voll = ['1', '2', '3', '4', '5'];
    const next = merkeAnweisung(voll, A);
    expect(next).toHaveLength(MAX_ANWEISUNGEN);
    expect(next[0]).toBe(A);
    expect(next).not.toContain('5');
  });

  it('kappt eine überlange Anweisung sichtbar', () => {
    const lang = 'W'.repeat(ANWEISUNG_MAX_LAENGE + 50);
    const [gemerkt] = merkeAnweisung([], lang);
    expect(gemerkt!.length).toBe(ANWEISUNG_MAX_LAENGE + 1); // + Auslassungszeichen
    expect(gemerkt!.endsWith('…')).toBe(true);
  });
});
