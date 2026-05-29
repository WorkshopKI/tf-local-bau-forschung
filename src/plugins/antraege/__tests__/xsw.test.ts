import { describe, it, expect } from 'vitest';
import { readXsw, tokenizeXsw, xswMatchesOwnKuerzel } from '../xsw';

describe('readXsw', () => {
  it('liest getrimmten t_xsw aus einem Record', () => {
    expect(readXsw({ t_xsw: '  Wiedereinreicher JoA  ' })).toBe('Wiedereinreicher JoA');
  });

  it('liefert null für leer / whitespace / Nicht-String / fehlend', () => {
    expect(readXsw({ t_xsw: '' })).toBeNull();
    expect(readXsw({ t_xsw: '   ' })).toBeNull();
    expect(readXsw({ t_xsw: 123 })).toBeNull();
    expect(readXsw({})).toBeNull();
    expect(readXsw(null)).toBeNull();
    expect(readXsw(undefined)).toBeNull();
  });
});

describe('tokenizeXsw', () => {
  it('splittet auf _, / und Whitespace und normalisiert (uppercase)', () => {
    expect(tokenizeXsw('Wiedereinreicher ZEP250142_JoA/KaLa')).toEqual([
      'WIEDEREINREICHER',
      'ZEP250142',
      'JOA',
      'KALA',
    ]);
  });
});

describe('xswMatchesOwnKuerzel', () => {
  const text = 'Wiedereinreicher ZEP250142_JoA/KaLa';

  it('matcht das eigene Kürzel (case-insensitiv)', () => {
    expect(xswMatchesOwnKuerzel(text, 'JoA')).toBe(true);
    expect(xswMatchesOwnKuerzel(text, 'joa')).toBe(true);
  });

  it('matcht eines von mehreren kommagetrennten eigenen Kürzeln', () => {
    expect(xswMatchesOwnKuerzel(text, 'XYZ,KaLa')).toBe(true);
  });

  it('matcht NICHT, wenn das eigene Kürzel fehlt', () => {
    expect(xswMatchesOwnKuerzel(text, 'XYZ')).toBe(false);
  });

  it('matcht per Token-Gleichheit, nicht als Substring (OA ⊄ JoA)', () => {
    expect(xswMatchesOwnKuerzel(text, 'OA')).toBe(false);
  });

  it('matcht Umlaut-Kürzel NFD vs. NFC (THÜ)', () => {
    const nfd = 'Wiedereinreicher THÜ'.normalize('NFD'); // THÜ als NFD
    expect(xswMatchesOwnKuerzel(nfd, 'THÜ'.normalize('NFC'))).toBe(true);
  });

  it('liefert false bei leerem Text oder leerem eigenen Kürzel', () => {
    expect(xswMatchesOwnKuerzel(null, 'JoA')).toBe(false);
    expect(xswMatchesOwnKuerzel(text, null)).toBe(false);
    expect(xswMatchesOwnKuerzel(text, '')).toBe(false);
    expect(xswMatchesOwnKuerzel(text, '   ')).toBe(false);
  });
});
