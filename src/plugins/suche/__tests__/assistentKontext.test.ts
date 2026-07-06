import { describe, it, expect } from 'vitest';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { buildTrefferKontext, kontextChipLabel } from '../assistentKontext';

function treffer(p: Partial<UnifiedSearchResult> & Pick<UnifiedSearchResult, 'id' | 'title'>): UnifiedSearchResult {
  return { type: 'antrag', score: 0.9, method: 'fulltext', snippet: '', ...p };
}

describe('buildTrefferKontext', () => {
  it('liefert Leerstring bei keinen Treffern', () => {
    expect(buildTrefferKontext([])).toBe('');
  });

  it('nummeriert Treffer und übernimmt Titel + FKZ + Snippet', () => {
    const out = buildTrefferKontext([
      treffer({ id: 'a', title: 'AM Qualität', fkz: '16KN086', snippet: 'Additive Fertigung' }),
    ]);
    expect(out).toContain('1. AM Qualität (16KN086)');
    expect(out).toContain('Additive Fertigung');
    expect(out).toContain('--- Aktuelle Suchtreffer (Kontext) ---');
    expect(out).toContain('--- Ende Suchtreffer ---');
  });

  it('lässt den FKZ-Zusatz weg, wenn kein FKZ vorhanden ist', () => {
    const out = buildTrefferKontext([treffer({ id: 'a', title: 'Ohne FKZ' })]);
    expect(out).toContain('1. Ohne FKZ');
    expect(out).not.toContain('()');
  });

  it('respektiert das Limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => treffer({ id: `t${i}`, title: `Treffer ${i}` }));
    const out = buildTrefferKontext(many, 3);
    expect(out).toContain('1. Treffer 0');
    expect(out).toContain('3. Treffer 2');
    expect(out).not.toContain('4. Treffer 3');
  });

  it('kollabiert Whitespace im Snippet und kürzt auf 300 Zeichen', () => {
    const long = 'wort '.repeat(200); // 1000 Zeichen, viele Spaces
    const out = buildTrefferKontext([treffer({ id: 'a', title: 'T', snippet: `foo\n\n  bar   baz` })]);
    expect(out).toContain('foo bar baz');
    const outLong = buildTrefferKontext([treffer({ id: 'b', title: 'T', snippet: long })]);
    const snippetLine = outLong.split('\n').find(l => l.startsWith('wort')) ?? '';
    expect(snippetLine.length).toBeLessThanOrEqual(300);
  });
});

describe('kontextChipLabel', () => {
  it('formatiert die Trefferzahl (numerus-invariant „Suchtreffer")', () => {
    expect(kontextChipLabel(1)).toBe('Kontext: 1 Suchtreffer');
    expect(kontextChipLabel(16)).toBe('Kontext: 16 Suchtreffer');
    expect(kontextChipLabel(0)).toBe('Kontext: 0 Suchtreffer');
  });
});
