import { describe, it, expect } from 'vitest';
import { pdfPageToMarkdown, type PdfTextFragment } from '../pdf-tables';

/** Bequemer Fragment-Builder (Breite grob aus der Textlänge). */
function f(str: string, x: number, y: number, width = str.length * 6): PdfTextFragment {
  return { str, x, y, width };
}

describe('pdfPageToMarkdown — Tabellen-Rekonstruktion', () => {
  it('erkennt ein sauberes 2-Spalten-Raster als Markdown-Tabelle', () => {
    const frags: PdfTextFragment[] = [
      f('Nr', 50, 700, 12), f('Bezeichnung', 200, 700, 60),
      f('1', 50, 680, 6), f('Analyse', 200, 680, 40),
      f('2', 51, 660, 6), f('Design', 201, 660, 36),
    ];
    const md = pdfPageToMarkdown(frags);
    expect(md).toContain('| Nr | Bezeichnung |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| 1 | Analyse |');
    expect(md).toContain('| 2 | Design |');
  });

  it('reiner Absatztext (eine Spalte je Zeile) bleibt Fließtext ohne Pipes', () => {
    const frags: PdfTextFragment[] = [
      f('Dies', 50, 600, 24), f('ist', 78, 600, 14), f('Text', 96, 600, 24),
      f('Zweite', 50, 580, 34), f('Zeile', 88, 580, 28),
    ];
    const md = pdfPageToMarkdown(frags);
    expect(md).not.toContain('|');
    expect(md).toContain('Dies ist Text');
    expect(md).toContain('Zweite Zeile');
  });

  it('zerstreute (nicht ausgerichtete) Lücken werden NICHT zur Tabelle', () => {
    const frags: PdfTextFragment[] = [
      f('links', 50, 500, 30), f('rechts', 300, 500, 36),
      f('mitte', 150, 480, 30), f('ende', 420, 480, 24),
    ];
    const md = pdfPageToMarkdown(frags);
    // Spaltenzahl (4 verschiedene x) passt nicht zu 2 Zellen/Zeile → Fließtext.
    expect(md).not.toContain('| --- |');
  });

  it('Kopfzeile + Tabelle: Überschrift bleibt Absatz, Raster wird Tabelle', () => {
    const frags: PdfTextFragment[] = [
      f('Arbeitspakete', 50, 720, 80), // einzelne Überschrift-Zeile
      f('AP', 50, 700, 12), f('Titel', 200, 700, 28),
      f('1', 50, 680, 6), f('Konzept', 200, 680, 42),
      f('2', 50, 660, 6), f('Umsetzung', 200, 660, 54),
    ];
    const md = pdfPageToMarkdown(frags);
    expect(md).toContain('Arbeitspakete');
    expect(md.indexOf('Arbeitspakete')).toBeLessThan(md.indexOf('| AP | Titel |'));
    expect(md).toContain('| AP | Titel |');
    expect(md).toContain('| 1 | Konzept |');
  });

  it('leere Seite → leerer String', () => {
    expect(pdfPageToMarkdown([])).toBe('');
    expect(pdfPageToMarkdown([f('   ', 0, 0, 0)])).toBe('');
  });
});
