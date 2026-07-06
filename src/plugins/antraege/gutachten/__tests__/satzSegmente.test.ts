import { describe, it, expect } from 'vitest';
import { satzSegmente, segmentierungAligned, zyklischerIndex } from '../satzSegmente';
import { splitSentences } from '@/core/services/skills';

describe('satzSegmente — aligned zur Engine-Segmentierung', () => {
  it('Array-Position entspricht dem satzIndex von splitSentences (gleiche Sätze, gleiche Reihenfolge)', () => {
    const text = 'Erster Satz. Zweiter Satz. Dritter Satz.';
    const segs = satzSegmente(text);
    expect(segs.map(s => s.satz)).toEqual(splitSentences(text));
  });

  it('rekonstruiert den Text verlustfrei über satz + sep (bis auf führende Zeichen)', () => {
    const text = 'Eins. Zwei.\n\nDrei.';
    const segs = satzSegmente(text);
    expect(segs.map(s => s.satz + s.sep).join('')).toBe(text);
    // Absatzumbruch bleibt als Trenn-Zeichen erhalten.
    expect(segs[1]!.sep).toContain('\n');
  });

  it('erster + letzter Satz sind adressierbar', () => {
    const text = 'Alpha. Beta. Gamma.';
    const segs = satzSegmente(text);
    expect(segs[0]!.satz).toBe('Alpha.');
    expect(segs[segs.length - 1]!.satz).toBe('Gamma.');
  });

  it('Abkürzungen erzeugen keinen Fehl-Split (wie die Engine)', () => {
    const text = 'Es nutzt z. B. MEMS. Es ist robust.';
    expect(satzSegmente(text)).toHaveLength(2);
  });
});

describe('segmentierungAligned — Block-Summe vs. Gesamttext', () => {
  it('true, wenn jeder Block satzsauber endet (Join per Absatz)', () => {
    const a = 'Eins. Zwei.';
    const b = 'Drei. Vier.';
    expect(segmentierungAligned(`${a}\n${b}`, [a, b])).toBe(true);
  });
  it('false, wenn ein Block ohne Satzende in den nächsten läuft', () => {
    const a = 'Eins ohne Punkt';
    const b = 'geht weiter. Zwei.';
    expect(segmentierungAligned(`${a}\n${b}`, [a, b])).toBe(false);
  });
});

describe('zyklischerIndex', () => {
  it('läuft zyklisch (wrap-around) und ist robust', () => {
    expect(zyklischerIndex(0, 3)).toBe(0);
    expect(zyklischerIndex(1, 3)).toBe(1);
    expect(zyklischerIndex(3, 3)).toBe(0);
    expect(zyklischerIndex(4, 3)).toBe(1);
    expect(zyklischerIndex(-1, 3)).toBe(2);
    expect(zyklischerIndex(5, 0)).toBe(0);
  });
});
