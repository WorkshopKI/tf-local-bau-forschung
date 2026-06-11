import { describe, it, expect } from 'vitest';
import { buildConversionReport, maxConversionLevel } from '../conversion-report';

describe('buildConversionReport — PDF', () => {
  it('warnt bei 0 Zeichen (gescanntes PDF)', () => {
    const r = buildConversionReport({ format: 'pdf', text: '   ', pages: 3 });
    expect(r.charCount).toBe(0);
    expect(r.warnings.some(w => w.level === 'warnung' && /gescanntes PDF/.test(w.message))).toBe(true);
  });

  it('warnt bei sehr wenig Text pro Seite', () => {
    const r = buildConversionReport({ format: 'pdf', text: 'x'.repeat(50), pages: 2 }); // 25/Seite < 80
    expect(r.warnings.some(w => w.level === 'warnung' && /Zeichen\/Seite/.test(w.message))).toBe(true);
  });

  it('keine Warnung bei genug Text', () => {
    const r = buildConversionReport({ format: 'pdf', text: 'x'.repeat(500), pages: 2 }); // 250/Seite
    expect(r.warnings).toHaveLength(0);
    expect(r.pages).toBe(2);
  });
});

describe('buildConversionReport — DOCX', () => {
  it('keine Warnung bei sauberem Text ohne Tabellen/Bilder', () => {
    const r = buildConversionReport({ format: 'docx', text: 'a'.repeat(300), html: '<p>text</p>' });
    expect(r.warnings).toHaveLength(0);
    expect(r.tableCount).toBe(0);
    expect(r.imageCount).toBe(0);
  });

  it('Hinweis bei Bildern (nicht als Text erfasst)', () => {
    const r = buildConversionReport({ format: 'docx', text: 'a'.repeat(300), html: '<img src="x"><img src="y">' });
    expect(r.imageCount).toBe(2);
    expect(r.warnings.some(w => w.level === 'hinweis' && /2 Bilder/.test(w.message))).toBe(true);
  });

  it('Hinweis bei Tabellen', () => {
    const r = buildConversionReport({ format: 'docx', text: 'a'.repeat(300), html: '<table><tr><td>x</td></tr></table>' });
    expect(r.tableCount).toBe(1);
    expect(r.warnings.some(w => w.level === 'hinweis' && /1 Tabelle/.test(w.message))).toBe(true);
  });

  it('Warnung bei kaum Text', () => {
    const r = buildConversionReport({ format: 'docx', text: 'kurz', html: '' });
    expect(r.warnings.some(w => w.level === 'warnung' && /Kaum Text/.test(w.message))).toBe(true);
  });

  it('dedupliziert + cappt mammoth-Messages bei 5', () => {
    const msgs = ['a', 'a', 'b', 'c', 'd', 'e', 'f', 'g']; // dedupe → 7 distinct
    const r = buildConversionReport({ format: 'docx', text: 'a'.repeat(300), html: '', mammothMessages: msgs });
    const hinweise = r.warnings.filter(w => w.level === 'hinweis');
    // 5 gezeigt + 1 „… und 2 weitere"
    expect(hinweise).toHaveLength(6);
    expect(hinweise[hinweise.length - 1]!.message).toContain('2 weitere');
  });
});

describe('buildConversionReport — txt + maxConversionLevel', () => {
  it('txt liefert nur charCount, keine Warnungen', () => {
    const r = buildConversionReport({ format: 'txt', text: 'hallo welt' });
    expect(r.charCount).toBe(10);
    expect(r.warnings).toHaveLength(0);
  });

  it('maxConversionLevel: warnung > hinweis > null', () => {
    expect(maxConversionLevel(undefined)).toBeNull();
    expect(maxConversionLevel({ charCount: 1, warnings: [] })).toBeNull();
    expect(maxConversionLevel({ charCount: 1, warnings: [{ level: 'hinweis', message: 'h' }] })).toBe('hinweis');
    expect(maxConversionLevel({ charCount: 1, warnings: [{ level: 'hinweis', message: 'h' }, { level: 'warnung', message: 'w' }] })).toBe('warnung');
  });
});
