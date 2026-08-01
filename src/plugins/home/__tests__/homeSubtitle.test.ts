import { describe, it, expect } from 'vitest';
import { formatHomeSubtitle, labelKritisch, labelWarnung } from '../homeSubtitle';
import { AMPEL_SCHWELLEN_DEFAULT } from '@/plugins/antraege/eingangAmpel';

const S = AMPEL_SCHWELLEN_DEFAULT; // 30 / 90

describe('formatHomeSubtitle — Singular/Plural', () => {
  it('offen === 1 → Singular „offener Vorgang"', () => {
    expect(formatHomeSubtitle(1)).toBe('1 offener Vorgang');
  });
  it('offen === 2 → Plural „offene Vorgänge"', () => {
    expect(formatHomeSubtitle(2)).toBe('2 offene Vorgänge');
  });
  it('offen === 0 → Plural „offene Vorgänge"', () => {
    expect(formatHomeSubtitle(0)).toBe('0 offene Vorgänge');
  });
});

describe('formatHomeSubtitle — de-DE-Zahlformat', () => {
  it('Tausender-Trennzeichen', () => {
    expect(formatHomeSubtitle(1500)).toBe('1.500 offene Vorgänge');
  });
});

describe('Regression: die Kopfzeile wiederholt die Kachel-Zahlen nicht', () => {
  // Bis v2.372.1 stand „493 älter als 90 Tage · 292 zwischen 31 und 90 Tagen"
  // wortgleich in der Kopfzeile UND als Kachel im Hero-Band UND als Zeile im
  // Antragseingang-Widget — dreimal dieselben zwei Zahlen im selben Blickfeld.
  it('die Kopfzeile trägt nur die Gesamtzahl', () => {
    const text = formatHomeSubtitle(909);
    expect(text).toBe('909 offene Vorgänge');
    expect(text).not.toMatch(/älter als|zwischen/);
  });
});

describe('Kachel-Beschriftungen: Alter statt Frist, Grenzen aus der Config', () => {
  it('Standard-Schwellen 30/90', () => {
    expect(labelKritisch(S)).toBe('älter als 90 Tage');
    expect(labelWarnung(S)).toBe('zwischen 31 und 90 Tagen');
  });

  // Bis v2.372.0 stand „90-Tage-Frist" fest im Text, während
  // `useEingangAmpelCounts` mit den Schwellen aus der Widget-Config zählte —
  // wer 14/60 einstellte, bekam die richtige Zahl unter falscher Beschriftung.
  it('eigene Schwellen schlagen bis in die Beschriftung durch', () => {
    const eigene = { warnschwelleTage: 14, kritischSchwelleTage: 60 };
    expect(labelKritisch(eigene)).toBe('älter als 60 Tage');
    expect(labelWarnung(eigene)).toBe('zwischen 15 und 60 Tagen');
  });

  it('kein „Frist" — der Wert ist ein Alter, kein Termin', () => {
    expect(`${labelKritisch(S)} ${labelWarnung(S)}`).not.toMatch(/Frist/i);
  });
});
