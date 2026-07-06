import { describe, it, expect } from 'vitest';
import { computeAutoTagVisibility } from '../autoTagVisibility';

const tag = (i: number): string => `tag-${i}`;
const many = (n: number): string[] => Array.from({ length: n }, (_, i) => tag(i));

describe('computeAutoTagVisibility', () => {
  it('zeigt alles, wenn nichts über den Cap geht', () => {
    const tags = many(6);
    const { sichtbar, versteckt } = computeAutoTagVisibility(tags, [], 10, false);
    expect(sichtbar).toEqual(tags);
    expect(versteckt).toBe(0);
  });

  it('kürzt NUR ungewählte Chips; gewählte bleiben IMMER sichtbar', () => {
    const tags = many(24);
    // 4 aktiv (nicht excluded), 20 excluded → excluded = tags[4..23]
    const excluded = tags.slice(4);
    const { sichtbar, versteckt } = computeAutoTagVisibility(tags, excluded, 10, false);
    // 4 aktiv + 6 Slots für inaktive = 10 sichtbar
    expect(sichtbar).toHaveLength(10);
    // alle 4 aktiven sind dabei
    for (const t of tags.slice(0, 4)) expect(sichtbar).toContain(t);
    // 20 inaktiv − 6 gezeigt = 14 versteckt
    expect(versteckt).toBe(14);
  });

  it('versteckt keine gewählten Chips, selbst wenn aktiv > cap', () => {
    const tags = many(15); // alle aktiv (excluded leer)
    const { sichtbar, versteckt } = computeAutoTagVisibility(tags, [], 10, false);
    expect(sichtbar).toEqual(tags); // alle 15 sichtbar
    expect(versteckt).toBe(0);
  });

  it('expanded zeigt alles ohne Versteck-Rest', () => {
    const tags = many(24);
    const excluded = tags.slice(4);
    const { sichtbar, versteckt } = computeAutoTagVisibility(tags, excluded, 10, true);
    expect(sichtbar).toEqual(tags);
    expect(versteckt).toBe(0);
  });

  it('erhält die Original-Reihenfolge (aktiv/inaktiv nicht gruppiert)', () => {
    const tags = ['a', 'b', 'c', 'd', 'e'];
    const excluded = ['a', 'c']; // b,d,e aktiv
    // cap 4 → slots = 4 - 3 = 1 → erste inaktive (a) gezeigt, c versteckt
    const { sichtbar, versteckt } = computeAutoTagVisibility(tags, excluded, 4, false);
    expect(sichtbar).toEqual(['a', 'b', 'd', 'e']);
    expect(versteckt).toBe(1);
  });

  it('akzeptiert Set und Array gleichwertig', () => {
    const tags = many(5);
    const asArr = computeAutoTagVisibility(tags, ['tag-1'], 10, false);
    const asSet = computeAutoTagVisibility(tags, new Set(['tag-1']), 10, false);
    expect(asArr).toEqual(asSet);
  });
});
