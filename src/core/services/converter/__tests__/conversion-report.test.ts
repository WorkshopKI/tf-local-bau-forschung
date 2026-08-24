import { describe, it, expect } from 'vitest';
import { buildConversionReport, maxConversionLevel, DOCX_UMWEG_MELDUNG } from '../conversion-report';

describe('PDF: was aus der Gliederung wurde', () => {
  const pdf = (stufe: 'strukturiert' | 'geschaetzt' | 'flach' | undefined) =>
    buildConversionReport({ format: 'pdf', text: 'x'.repeat(4000), pages: 4, pdfStruktur: stufe });

  it('meldet den Umweg über den PDF-Client NUR, wenn die Gliederung fehlt oder geraten ist', () => {
    const hat = (stufe: 'strukturiert' | 'geschaetzt' | 'flach'): boolean =>
      pdf(stufe).warnings.some(w => w.message === DOCX_UMWEG_MELDUNG);
    expect(hat('strukturiert')).toBe(false);
    expect(hat('geschaetzt')).toBe(true);
    expect(hat('flach')).toBe(true);
  });

  it('stuft „flach" als Warnung ein, „geschätzt" als Hinweis — und alarmiert nicht, wenn alles gut ist', () => {
    expect(maxConversionLevel(pdf('flach'))).toBe('warnung');
    expect(maxConversionLevel(pdf('geschaetzt'))).toBe('hinweis');
    expect(maxConversionLevel(pdf('strukturiert'))).toBe('gut');
  });

  it('reicht die Stufe im Bericht durch — und schweigt ohne sie (Stand bis v6.27)', () => {
    expect(pdf('strukturiert').pdfStruktur).toBe('strukturiert');
    expect(pdf(undefined).pdfStruktur).toBeUndefined();
    expect(pdf(undefined).warnings).toHaveLength(0);
  });

  it('sagt bei 0 Zeichen nichts über die Gliederung — dann ist der Text das Problem', () => {
    const r = buildConversionReport({ format: 'pdf', text: '', pages: 4, pdfStruktur: 'flach' });
    expect(r.warnings.some(w => w.message.includes('gescanntes PDF'))).toBe(true);
    expect(r.warnings.some(w => w.message === DOCX_UMWEG_MELDUNG)).toBe(false);
  });
});

describe('PDF: fehlendes Zusatz-Asset', () => {
  // Der Regelfall ist der stille Textverlust — pdf.js warnt und liefert
  // weniger Text. Ohne diese Warnung liest der Bearbeiter „vermutlich
  // gescannt" und versucht OCR an einem PDF, das Text hat.
  it('meldet den Klartext, wenn die Zeichentabelle fehlt UND kein Text herauskam', () => {
    const r = buildConversionReport({ format: 'pdf', text: '', pages: 2, pdfCmapFehlt: true });
    expect(r.warnings.some(w => w.level === 'warnung' && w.message.includes('außerhalb der App')))
      .toBe(true);
  });

  it('schweigt, wenn trotz der Warnung brauchbarer Text herauskam', () => {
    // Der wichtigste Fall: an echten Dokumenten gemessen liefert pdf.js auch
    // dann Text, wenn es über ein Asset klagt. Wo Text ist, gibt es nichts zu
    // melden — sonst warnt die App bei praktisch jedem PDF.
    const r = buildConversionReport({
      format: 'pdf', text: 'viel Text '.repeat(50), pages: 1, pdfCmapFehlt: true,
    });
    expect(r.warnings).toEqual([]);
  });

  it('ohne das Feld bleibt der Report unveraendert — gute PDFs merken nichts', () => {
    const ohne = buildConversionReport({ format: 'pdf', text: 'viel Text '.repeat(50), pages: 1 });
    const mitFalse = buildConversionReport({
      format: 'pdf', text: 'viel Text '.repeat(50), pages: 1, pdfCmapFehlt: false,
    });
    expect(ohne.warnings).toEqual([]);
    expect(mitFalse.warnings).toEqual([]);
  });

  it('ERSETZT die Gescannt-Vermutung, statt danebenzustehen', () => {
    // Beide beschreiben denselben fehlenden Text, aber nur eine nennt die
    // Ursache — und sie widersprechen einander: OCR hilft bei einer fehlenden
    // Zeichentabelle nicht.
    const r = buildConversionReport({ format: 'pdf', text: '', pages: 3, pdfCmapFehlt: true });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.message).toContain('Zeichentabelle');
    expect(r.warnings.some(w => w.message.includes('gescanntes PDF'))).toBe(false);
  });

  it('ohne die Warnung bleibt die Gescannt-Vermutung, wie sie war', () => {
    const r = buildConversionReport({ format: 'pdf', text: '', pages: 3 });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]?.message).toContain('gescanntes PDF');
  });
});

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
