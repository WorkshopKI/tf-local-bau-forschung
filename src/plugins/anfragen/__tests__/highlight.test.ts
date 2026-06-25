/** Phase 6 — Segment-Bildung fürs Live-Highlight (Intervall-/Off-by-one-Logik). */
import { describe, expect, it } from 'vitest';
import { buildSegments, mergeRanges } from '../highlight';
import type { Treffer } from '../services/export-guard';

const t = (index: number, laenge: number): Treffer =>
  ({ index, laenge, wert: 'x'.repeat(laenge), typ: 'sonstiges', quelle: 'pattern' });

describe('buildSegments', () => {
  it('ohne Treffer → ein unmarkiertes Segment', () => {
    expect(buildSegments('abcdef', [])).toEqual([{ text: 'abcdef', mark: false }]);
  });

  it('einzelner Treffer in der Mitte', () => {
    // "ab[cd]ef" → c..e
    expect(buildSegments('abcdef', [t(2, 2)])).toEqual([
      { text: 'ab', mark: false },
      { text: 'cd', mark: true },
      { text: 'ef', mark: false },
    ]);
  });

  it('Treffer am Anfang und am Ende', () => {
    expect(buildSegments('abcdef', [t(0, 2), t(4, 2)])).toEqual([
      { text: 'ab', mark: true },
      { text: 'cd', mark: false },
      { text: 'ef', mark: true },
    ]);
  });

  it('überlappende Treffer werden gemerged', () => {
    expect(mergeRanges([t(1, 3), t(2, 3)])).toEqual([[1, 5]]);
    expect(buildSegments('abcdefg', [t(1, 3), t(2, 3)])).toEqual([
      { text: 'a', mark: false },
      { text: 'bcde', mark: true },
      { text: 'fg', mark: false },
    ]);
  });
});
