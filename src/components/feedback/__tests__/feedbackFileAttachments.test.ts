/**
 * Tests für die Datei-Anhang-Validierung (v2.199.1): Whitelist + Größenlimit +
 * Endungs-Ableitung. Reine Funktionen — node-testbar.
 */
import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_MAX_FILE_BYTES,
  extFromFileName,
  feedbackFileTypeForName,
  validateFeedbackFile,
} from '../feedbackAttachments';

describe('extFromFileName', () => {
  it('liefert die kleingeschriebene Endung', () => {
    expect(extFromFileName('Bericht.PDF')).toBe('pdf');
    expect(extFromFileName('a.b.xlsx')).toBe('xlsx');
    expect(extFromFileName('ohne-endung')).toBe('');
    expect(extFromFileName(undefined)).toBe('');
  });
});

describe('feedbackFileTypeForName', () => {
  it('erkennt erlaubte Typen', () => {
    expect(feedbackFileTypeForName('x.docx')?.label).toBe('Word');
    expect(feedbackFileTypeForName('x.pptx')?.icon).toBe('Presentation');
    expect(feedbackFileTypeForName('x.md')?.ext).toBe('md');
  });
  it('lehnt unbekannte Typen ab', () => {
    expect(feedbackFileTypeForName('x.exe')).toBeNull();
    expect(feedbackFileTypeForName('x.png')).toBeNull(); // Bilder laufen getrennt
  });
});

describe('validateFeedbackFile', () => {
  it('akzeptiert erlaubte Typen unter dem Limit', () => {
    const r = validateFeedbackFile({ name: 'Konzept.pdf', size: 1_000_000 });
    expect(r.ok).toBe(true);
  });
  it('lehnt nicht-gelistete Typen ab', () => {
    expect(validateFeedbackFile({ name: 'virus.exe', size: 10 })).toEqual({ ok: false, reason: 'type' });
  });
  it('lehnt zu große Dateien ab', () => {
    expect(validateFeedbackFile({ name: 'gross.pptx', size: FEEDBACK_MAX_FILE_BYTES + 1 }))
      .toEqual({ ok: false, reason: 'size' });
  });
  it('akzeptiert exakt am Limit', () => {
    expect(validateFeedbackFile({ name: 'grenze.xlsx', size: FEEDBACK_MAX_FILE_BYTES }).ok).toBe(true);
  });
  it('lehnt leere Dateien ab', () => {
    expect(validateFeedbackFile({ name: 'leer.txt', size: 0 })).toEqual({ ok: false, reason: 'empty' });
  });
});
