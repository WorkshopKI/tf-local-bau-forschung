import { describe, it, expect } from 'vitest';
import { capVbMarkdown, vbUeberschreitetCap, VB_CHAR_CAP } from '../run-skill';

describe('capVbMarkdown', () => {
  it('lässt VB unter dem Cap unverändert (gekuerzt:false)', () => {
    const md = 'Kurzer Text.';
    expect(capVbMarkdown(md, 1000)).toEqual({ text: md, gekuerzt: false });
  });

  it('kürzt über dem Cap und markiert gekuerzt:true mit …-Suffix', () => {
    const md = 'x'.repeat(500);
    const res = capVbMarkdown(md, 100);
    expect(res.gekuerzt).toBe(true);
    expect(res.text.endsWith('…')).toBe(true);
    expect(res.text.length).toBeLessThan(md.length);
  });

  it('schneidet am letzten Absatzumbruch vor dem Cap', () => {
    // Absatzgrenze bei 80 (> cap*0.5), Cap 100 → Schnitt bei 80, Rest verworfen.
    const md = 'A'.repeat(78) + '\n\n' + 'B'.repeat(200);
    const res = capVbMarkdown(md, 100);
    expect(res.gekuerzt).toBe(true);
    expect(res.text).toBe('A'.repeat(78) + '\n\n…');
  });

  it('nutzt VB_CHAR_CAP als Default-Cap', () => {
    expect(capVbMarkdown('kurz').gekuerzt).toBe(false);
    expect(capVbMarkdown('y'.repeat(VB_CHAR_CAP + 1)).gekuerzt).toBe(true);
  });
});

describe('vbUeberschreitetCap', () => {
  it('vergleicht die Markdown-Länge gegen den Cap', () => {
    expect(vbUeberschreitetCap('abc', 3)).toBe(false); // ==, nicht >
    expect(vbUeberschreitetCap('abcd', 3)).toBe(true);
  });
});
