import { describe, it, expect } from 'vitest';
import {
  extractFkz,
  extractFkzStrict,
  extractFkzTolerant,
  isValidFkz,
} from '../matcher/fkz-extractor';

describe('extractFkzStrict', () => {
  it('matcht kanonische FKZs am Anfang', () => {
    expect(extractFkzStrict('16KN093323_ÄB Personalwechsel')?.fkz).toBe('16KN093323');
    expect(extractFkzStrict('16EP250229_Schluss')?.fkz).toBe('16EP250229');
    expect(extractFkzStrict('16DS001234')?.fkz).toBe('16DS001234');
    expect(extractFkzStrict('16DL999999')?.fkz).toBe('16DL999999');
  });

  it('matcht FKZs auch wenn von _ umschlossen', () => {
    expect(extractFkzStrict('Datei_16KN084935_Bescheid')?.fkz).toBe('16KN084935');
  });

  it('matcht FKZ mittendrin im String', () => {
    expect(extractFkzStrict('Mail an Sylvia: AW 16KN116801 Nachforderung')?.fkz).toBe('16KN116801');
  });

  it('verweigert nicht-erlaubte Präfixe', () => {
    // 16QK ist nicht in der Default-Allowlist
    expect(extractFkzStrict('16QK023456_test')).toBeNull();
    expect(extractFkzStrict('16TK037612 Outgoing')).toBeNull();
  });

  it('verweigert zu wenige Ziffern', () => {
    expect(extractFkzStrict('16KN084 unvollständig')).toBeNull();
    expect(extractFkzStrict('16KN02D - 5 Zeichen')).toBeNull();
  });

  it('verweigert 7 Ziffern (negative-lookahead)', () => {
    expect(extractFkzStrict('16KN0843510')).toBeNull();
  });
});

describe('extractFkzTolerant', () => {
  it('toleriert lI/I als 1 in der Vor-Ziffer', () => {
    expect(extractFkzTolerant('I6KN084935')?.fkz).toBe('16KN084935');
    expect(extractFkzTolerant('lKN084935')).toBeNull(); // alleinstehendes l ohne 6 davor
  });

  it('toleriert G/O als 6 in der Vor-Ziffer', () => {
    expect(extractFkzTolerant('1GKN084935')?.fkz).toBe('16KN084935');
    expect(extractFkzTolerant('1OKN084935')?.fkz).toBe('16KN084935');
  });

  it('normalisiert O→0, I→1, B→8 in den 6 Ziffern', () => {
    expect(extractFkzTolerant('16KNO84935')?.fkz).toBe('16KN084935');
    expect(extractFkzTolerant('16KN08493B')?.fkz).toBe('16KN084938');
    expect(extractFkzTolerant('16KNI84935')?.fkz).toBe('16KN184935');
  });

  it('toleriert 0–2 Whitespace zwischen Komponenten', () => {
    expect(extractFkzTolerant('16 KN 084935')?.fkz).toBe('16KN084935');
    expect(extractFkzTolerant('16  KN  084935')?.fkz).toBe('16KN084935');
  });

  it('verweigert >2 Whitespace', () => {
    expect(extractFkzTolerant('16   KN   084935')).toBeNull();
  });
});

describe('extractFkz (combined)', () => {
  it('bevorzugt strict vor tolerant', () => {
    expect(extractFkz('16KN084935')?.fkz).toBe('16KN084935');
    // tolerant fängt OCR-Schreibweisen
    expect(extractFkz('1OKN084935')?.fkz).toBe('16KN084935');
  });
});

describe('isValidFkz', () => {
  it('akzeptiert kanonische FKZs', () => {
    expect(isValidFkz('16KN084935')).toBe(true);
    expect(isValidFkz('16EP250229')).toBe(true);
  });

  it('lehnt unbekannte Präfixe ab', () => {
    expect(isValidFkz('16QK023456')).toBe(false);
  });

  it('lehnt falsches Format ab', () => {
    expect(isValidFkz('16kn084935')).toBe(false);  // lowercase
    expect(isValidFkz('1KN084935')).toBe(false);   // 1 statt 2 Ziffern
    expect(isValidFkz('16KN08493')).toBe(false);   // 5 statt 6 Endziffern
  });
});
