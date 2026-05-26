import { describe, it, expect } from 'vitest';
import {
  resolveAnonIdForUser,
  nextFreeAnonId,
  normalizeKuerzel,
} from '../services/anonym-map';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';

function makeAntrag(az: string, tib?: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    tib_kuerz: tib,
    _field_sources: {},
    _updated_at: new Date().toISOString(),
  } as Antrag;
}

describe('normalizeKuerzel', () => {
  it('trimmt und uppercased', () => {
    expect(normalizeKuerzel(' mue ')).toBe('MUE');
  });
  it('non-string -> null', () => {
    expect(normalizeKuerzel(null)).toBe(null);
    expect(normalizeKuerzel(undefined)).toBe(null);
    expect(normalizeKuerzel(42)).toBe(null);
  });
  it('leerer String -> null', () => {
    expect(normalizeKuerzel('')).toBe(null);
    expect(normalizeKuerzel('   ')).toBe(null);
  });
  it('NFC: behandelt NFC- und NFD-Umlaut-Formen identisch', () => {
    // CSV-Quellen koennen "ü" precomposed (NFC, U+00FC) ODER decomposed
    // (NFD, "u" + U+0308 Combining-Diaeresis) liefern. Ohne NFC-Normalisierung
    // waeren das verschiedene Map-Keys.
    const nfc = 'THÜ';                          // U+00DC = Ü precomposed
    const nfd = 'TH' + 'U' + '̈';     // U+0055 (U) + U+0308 (combining diaeresis)
    expect(normalizeKuerzel(nfc)).toBe(normalizeKuerzel(nfd));
    expect(normalizeKuerzel('THü')).toBe(normalizeKuerzel('thü'));
  });
  it('NFC: typische deutsche Umlaut-Kürzel werden konsistent', () => {
    expect(normalizeKuerzel('THü')).toBe('THÜ');
    expect(normalizeKuerzel('Müller')).toBe('MÜLLER');
    expect(normalizeKuerzel('Bär')).toBe('BÄR');
    expect(normalizeKuerzel('groß')).toBe('GROSS');  // ß → SS (ASCII upper)
  });
});

describe('resolveAnonIdForUser', () => {
  const map = buildAnonymMapForTests([
    makeAntrag('A1', 'MUE'),
    makeAntrag('A2', 'SCH'),
  ]);

  it('match exakt', () => {
    expect(resolveAnonIdForUser('MUE', map)).toBe(map.toAnon.get('MUE'));
  });
  it('match case-insensitive', () => {
    expect(resolveAnonIdForUser('mue', map)).toBe(map.toAnon.get('MUE'));
  });
  it('Mehrfach-Kuerzel -> erstes matchendes', () => {
    expect(resolveAnonIdForUser('XYZ,MUE', map)).toBe(map.toAnon.get('MUE'));
  });
  it('"alle" -> null (Filter deaktiviert)', () => {
    expect(resolveAnonIdForUser('alle', map)).toBe(null);
    expect(resolveAnonIdForUser('Alle', map)).toBe(null);
  });
  it('unbekannt -> null', () => {
    expect(resolveAnonIdForUser('XYZ', map)).toBe(null);
  });
  it('leer -> null', () => {
    expect(resolveAnonIdForUser('', map)).toBe(null);
    expect(resolveAnonIdForUser(undefined, map)).toBe(null);
  });
});

describe('nextFreeAnonId', () => {
  it('leeres Set -> MA01', () => {
    expect(nextFreeAnonId([])).toBe('MA01');
  });
  it('Luecke fuellen', () => {
    expect(nextFreeAnonId(['MA01', 'MA03'])).toBe('MA02');
  });
  it('keine Luecke -> n+1', () => {
    expect(nextFreeAnonId(['MA01', 'MA02', 'MA03'])).toBe('MA04');
  });
  it('non-MA-Eintraege werden ignoriert', () => {
    expect(nextFreeAnonId(['XX', 'MA01', 'MA02'])).toBe('MA03');
  });
});
