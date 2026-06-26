/** Phase 6 — Segment-Bildung fürs Live-Highlight (Intervall-/Off-by-one-Logik). */
import { describe, expect, it } from 'vitest';
import { buildSegments, buildKindedSegments, mergeRanges, platzhalterRanges, type KindedRange } from '../highlight';
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

const r = (start: number, end: number, kind: KindedRange['kind']): KindedRange => ({ start, end, kind });

describe('buildKindedSegments', () => {
  it('leerer Text → keine Segmente', () => {
    expect(buildKindedSegments('', [r(0, 1, 'pii')])).toEqual([]);
  });

  it('ohne Ranges → ein unmarkiertes Segment, deckt den ganzen Text', () => {
    expect(buildKindedSegments('abcdef', [])).toEqual([{ text: 'abcdef', kind: null }]);
  });

  it('disjunkte Ranges verschiedener Arten', () => {
    // "ab[cd]e[f]" → cd=placeholder, f=pii
    expect(buildKindedSegments('abcdef', [r(2, 4, 'placeholder'), r(5, 6, 'pii')])).toEqual([
      { text: 'ab', kind: null },
      { text: 'cd', kind: 'placeholder' },
      { text: 'e', kind: null },
      { text: 'f', kind: 'pii' },
    ]);
  });

  it('Überlappung: höhere Priorität gewinnt (leak > placeholder > pii)', () => {
    // placeholder [1,5) + leak [2,4) → b=ph, cd=leak, e=ph
    expect(buildKindedSegments('abcdef', [r(1, 5, 'placeholder'), r(2, 4, 'leak')])).toEqual([
      { text: 'a', kind: null },
      { text: 'b', kind: 'placeholder' },
      { text: 'cd', kind: 'leak' },
      { text: 'e', kind: 'placeholder' },
      { text: 'f', kind: null },
    ]);
  });

  it('Reihenfolge der Ranges egal — Priorität, nicht Insert-Order, entscheidet', () => {
    const a = buildKindedSegments('xyz', [r(0, 3, 'pii'), r(0, 3, 'leak')]);
    const b = buildKindedSegments('xyz', [r(0, 3, 'leak'), r(0, 3, 'pii')]);
    expect(a).toEqual([{ text: 'xyz', kind: 'leak' }]);
    expect(b).toEqual(a);
  });

  it('Klartext (join der Segmente) bleibt unverändert', () => {
    const text = 'Sehr geehrter [PERSON_1], siehe [HOSTNAME_1].';
    const segs = buildKindedSegments(text, platzhalterRanges(text));
    expect(segs.map(s => s.text).join('')).toBe(text);
    expect(segs.filter(s => s.kind === 'placeholder').map(s => s.text)).toEqual(['[PERSON_1]', '[HOSTNAME_1]']);
  });
});

describe('platzhalterRanges', () => {
  it('findet [TYP_N]-Platzhalter', () => {
    expect(platzhalterRanges('a [PERSON_1] b [ORT_12] c')).toEqual([
      { start: 2, end: 12, kind: 'placeholder' },
      { start: 15, end: 23, kind: 'placeholder' },
    ]);
  });

  it('ignoriert Nicht-Platzhalter-Klammern', () => {
    expect(platzhalterRanges('[abc] [Person_1] [PERSON]')).toEqual([]);
  });
});
