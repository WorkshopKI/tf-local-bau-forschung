/**
 * Unit-Tests fuer die TIB-Mail-Aufloesung + E-Mail-Vorlage (v2.12).
 */
import { describe, it, expect } from 'vitest';
import { buildKuerzelMailMap, interpolateMailTemplate, buildMailtoUrl } from '../services/tib-mail';
import type { Antrag } from '@/core/services/csv/types';

function rec(tib_kuerz: string, tib_mail?: string): Antrag {
  return { tib_kuerz, ...(tib_mail !== undefined ? { tib_mail } : {}) } as unknown as Antrag;
}

describe('buildKuerzelMailMap', () => {
  it('mappt kuerzel → email (normalisiert NFC + uppercase)', () => {
    const map = buildKuerzelMailMap([rec('mue', 'mue@x.de'), rec('sch', 'sch@x.de')]);
    expect(map.get('MUE')).toBe('mue@x.de');
    expect(map.get('SCH')).toBe('sch@x.de');
    expect(map.size).toBe(2);
  });

  it('ueberspringt leere Mail, nimmt die erste nicht-leere', () => {
    const map = buildKuerzelMailMap([rec('mue', ''), rec('mue', '  '), rec('mue', 'real@x.de'), rec('mue', 'spaeter@x.de')]);
    expect(map.get('MUE')).toBe('real@x.de');
  });

  it('Kuerzel ohne Mail → nicht in der Map', () => {
    const map = buildKuerzelMailMap([rec('mue'), rec('sch', 'sch@x.de')]);
    expect(map.has('MUE')).toBe(false);
    expect(map.get('SCH')).toBe('sch@x.de');
  });

  it('trimmt die Mail', () => {
    const map = buildKuerzelMailMap([rec('mue', '  mue@x.de  ')]);
    expect(map.get('MUE')).toBe('mue@x.de');
  });
});

describe('interpolateMailTemplate', () => {
  it('ersetzt Platzhalter', () => {
    expect(interpolateMailTemplate('Hallo {kuerzel}, PW: {passwort}', { kuerzel: 'MUE', passwort: 'a-b' }))
      .toBe('Hallo MUE, PW: a-b');
  });
  it('laesst unbekannte Platzhalter stehen', () => {
    expect(interpolateMailTemplate('{kuerzel} {unbekannt}', { kuerzel: 'MUE' })).toBe('MUE {unbekannt}');
  });
});

describe('buildMailtoUrl', () => {
  it('baut mailto mit Empfaenger + encodetem Betreff/Body', () => {
    const url = buildMailtoUrl('mue@x.de', 'Betreff {kuerzel}', 'Body {passwort}', { kuerzel: 'MUE', passwort: 'a-b' });
    expect(url.startsWith('mailto:mue%40x.de?')).toBe(true);
    expect(url).toContain('subject=Betreff%20MUE');
    expect(url).toContain('body=Body%20a-b');
  });
  it('ohne Empfaenger → mailto ohne Adresse', () => {
    const url = buildMailtoUrl('', 'B', 'T', {});
    expect(url.startsWith('mailto:?')).toBe(true);
  });
});
