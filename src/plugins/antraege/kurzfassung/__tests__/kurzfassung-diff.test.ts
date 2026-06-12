import { describe, it, expect } from 'vitest';
import { computeFinalerTextDiff, diffStats } from '../kurzfassung-diff';

describe('computeFinalerTextDiff', () => {
  it('identischer Text → nur Gleichheits-Segment (op 0)', () => {
    const diffs = computeFinalerTextDiff('Gleicher Text.', 'Gleicher Text.');
    expect(diffs.every(([op]) => op === 0)).toBe(true);
    expect(diffs.map(([, t]) => t).join('')).toBe('Gleicher Text.');
  });

  it('erkennt eine Einfügung (op +1) in der neuen Fassung', () => {
    const diffs = computeFinalerTextDiff('Das Projekt entwickelt ein System.', 'Das Projekt entwickelt ein neues System.');
    const eingefuegt = diffs.filter(([op]) => op === 1).map(([, t]) => t).join('');
    expect(eingefuegt).toContain('neues');
    expect(diffs.some(([op]) => op === -1)).toBe(false);
  });

  it('erkennt eine Löschung (op -1) gegenüber der alten Fassung', () => {
    const diffs = computeFinalerTextDiff('Das alte ausführliche System.', 'Das System.');
    const geloescht = diffs.filter(([op]) => op === -1).map(([, t]) => t).join('');
    expect(geloescht).toContain('alte');
  });
});

describe('diffStats', () => {
  it('zählt eingefügte und entfernte Zeichen', () => {
    const diffs = computeFinalerTextDiff('abc', 'abXYZc');
    const stats = diffStats(diffs);
    expect(stats.added).toBe(3); // XYZ
    expect(stats.removed).toBe(0);
  });

  it('reine Löschung → removed > 0, added 0', () => {
    const stats = diffStats(computeFinalerTextDiff('abXYZc', 'abc'));
    expect(stats.removed).toBe(3);
    expect(stats.added).toBe(0);
  });
});
