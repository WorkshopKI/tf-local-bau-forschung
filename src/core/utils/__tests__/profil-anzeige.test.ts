import { describe, it, expect } from 'vitest';
import {
  initialenVon,
  kuerzelFuerAnzeige,
  profilAvatarText,
  vornameVon,
} from '../profil-anzeige';

describe('initialenVon', () => {
  it('erstes + letztes Wort', () => expect(initialenVon('Thomas Hollerith')).toBe('TH'));
  it('drei Wörter: erstes + letztes', () => expect(initialenVon('Max von Mustermann')).toBe('MM'));
  it('ein Wort: nur erster Buchstabe', () => expect(initialenVon('Thomas')).toBe('T'));
  it('leer → ?', () => expect(initialenVon('')).toBe('?'));
  it('undefined → ?', () => expect(initialenVon(undefined)).toBe('?'));
  it('nur Whitespace → ?', () => expect(initialenVon('   ')).toBe('?'));
  it('lowercase wird uppercase', () => expect(initialenVon('thomas hollerith')).toBe('TH'));
});

describe('kuerzelFuerAnzeige', () => {
  it('normales Kürzel', () => expect(kuerzelFuerAnzeige('MUE')).toBe('MUE'));
  it('Umlaut-Kürzel NFC', () => expect(kuerzelFuerAnzeige('thü')).toBe('THÜ'));
  it('THÜ bleibt unverändert (NFC)', () => expect(kuerzelFuerAnzeige('THÜ')).toBe('THÜ'));
  it('Komma-Vertretung → erstes Token', () => expect(kuerzelFuerAnzeige('MUE, SCH')).toBe('MUE'));
  it('Komma ohne Leerzeichen', () => expect(kuerzelFuerAnzeige('MUE,SCH')).toBe('MUE'));
  it('leer → undefined', () => expect(kuerzelFuerAnzeige('')).toBeUndefined());
  it('undefined → undefined', () => expect(kuerzelFuerAnzeige(undefined)).toBeUndefined());
  it('alle lowercase → undefined', () => expect(kuerzelFuerAnzeige('alle')).toBeUndefined());
  it('Alle mixed → undefined', () => expect(kuerzelFuerAnzeige('Alle')).toBeUndefined());
  it('ALLE uppercase → undefined', () => expect(kuerzelFuerAnzeige('ALLE')).toBeUndefined());
  it('maximal 4 Zeichen', () => expect(kuerzelFuerAnzeige('ABCDE')!.length).toBeLessThanOrEqual(4));
  it('lowercase wird uppercase', () => expect(kuerzelFuerAnzeige('mue')).toBe('MUE'));
});

describe('profilAvatarText', () => {
  it('Kürzel schlägt Initialen', () => expect(profilAvatarText('THÜ', 'Thomas Hollerith')).toBe('THÜ'));
  it('kein Kürzel → Initialen', () => expect(profilAvatarText(undefined, 'Thomas Hollerith')).toBe('TH'));
  it('alle → Initialen', () => expect(profilAvatarText('alle', 'Thomas Hollerith')).toBe('TH'));
  it('Alle → Initialen', () => expect(profilAvatarText('Alle', 'Thomas Hollerith')).toBe('TH'));
  it('leeres Kürzel → Initialen', () => expect(profilAvatarText('', 'Thomas Hollerith')).toBe('TH'));
  it('kein Kürzel, kein Name → ?', () => expect(profilAvatarText(undefined, '')).toBe('?'));
});

describe('vornameVon', () => {
  it('zweiteiliger Name → erster Teil', () => expect(vornameVon('Thomas Hollerith')).toBe('Thomas'));
  it('einteiliger Name → unverändert', () => expect(vornameVon('Thomas')).toBe('Thomas'));
  it('leer → leerer String', () => expect(vornameVon('')).toBe(''));
  it('undefined → leerer String', () => expect(vornameVon(undefined)).toBe(''));
  it('nur Whitespace → leerer String', () => expect(vornameVon('   ')).toBe(''));
  it('führendes Whitespace wird ignoriert', () => expect(vornameVon('  Thomas Hollerith')).toBe('Thomas'));
  it('TH PL → TH', () => expect(vornameVon('TH PL')).toBe('TH'));
});
