import { describe, it, expect } from 'vitest';
import { formatHomeSubtitle, labelKritisch, labelWarnung } from '../homeSubtitle';
import { AMPEL_SCHWELLEN_DEFAULT } from '@/plugins/antraege/eingangAmpel';

const S = AMPEL_SCHWELLEN_DEFAULT; // 30 / 90

describe('formatHomeSubtitle — Mockup-Fall', () => {
  it('47 / 38 / 9 (== Ampel-Karten-Zahlen)', () => {
    expect(formatHomeSubtitle({ offen: 47, kritisch: 38, warnung: 9 }, S)).toEqual({
      offen: '47 offene Vorgänge',
      kritisch: '38 älter als 90 Tage',
      warnung: '9 zwischen 31 und 90 Tagen',
    });
  });
});

describe('formatHomeSubtitle — Singular/Plural', () => {
  it('offen === 1 → Singular „offener Vorgang"', () => {
    expect(formatHomeSubtitle({ offen: 1, kritisch: 0, warnung: 0 }, S).offen).toBe('1 offener Vorgang');
  });
  it('offen === 2 → Plural „offene Vorgänge"', () => {
    expect(formatHomeSubtitle({ offen: 2, kritisch: 0, warnung: 0 }, S).offen).toBe('2 offene Vorgänge');
  });
  it('offen === 0 → Plural „offene Vorgänge"', () => {
    expect(formatHomeSubtitle({ offen: 0, kritisch: 0, warnung: 0 }, S).offen).toBe('0 offene Vorgänge');
  });
});

describe('formatHomeSubtitle — Null-Teile bei Zähler 0', () => {
  it('kritisch === 0 ∧ warnung === 0 → nur offen', () => {
    const parts = formatHomeSubtitle({ offen: 12, kritisch: 0, warnung: 0 }, S);
    expect(parts.kritisch).toBeNull();
    expect(parts.warnung).toBeNull();
    expect(parts.offen).toBe('12 offene Vorgänge');
  });
  it('nur kritisch → warnung-Teil entfällt', () => {
    const parts = formatHomeSubtitle({ offen: 5, kritisch: 3, warnung: 0 }, S);
    expect(parts.kritisch).toBe('3 älter als 90 Tage');
    expect(parts.warnung).toBeNull();
  });
  it('nur warnung → kritisch-Teil entfällt', () => {
    const parts = formatHomeSubtitle({ offen: 5, kritisch: 0, warnung: 2 }, S);
    expect(parts.kritisch).toBeNull();
    expect(parts.warnung).toBe('2 zwischen 31 und 90 Tagen');
  });
});

describe('formatHomeSubtitle — de-DE-Zahlformat', () => {
  it('Tausender-Trennzeichen', () => {
    expect(formatHomeSubtitle({ offen: 1500, kritisch: 1234, warnung: 0 }, S)).toMatchObject({
      offen: '1.500 offene Vorgänge',
      kritisch: '1.234 älter als 90 Tage',
    });
  });
});

describe('Regression: der Text nennt die KONFIGURIERTE Grenze', () => {
  // Bis v2.372.0 stand „90-Tage-Frist" fest im Text, während
  // `useEingangAmpelCounts` mit den Schwellen aus der Widget-Config zählte —
  // wer 14/60 einstellte, bekam die richtige Zahl unter falscher Beschriftung.
  const eigene = { warnschwelleTage: 14, kritischSchwelleTage: 60 };

  it('Kopfzeile übernimmt eigene Schwellen', () => {
    const parts = formatHomeSubtitle({ offen: 9, kritisch: 4, warnung: 2 }, eigene);
    expect(parts.kritisch).toBe('4 älter als 60 Tage');
    expect(parts.warnung).toBe('2 zwischen 15 und 60 Tagen');
  });

  it('die Kachel-Beschriftungen stammen aus derselben Quelle', () => {
    expect(labelKritisch(eigene)).toBe('älter als 60 Tage');
    expect(labelWarnung(eigene)).toBe('zwischen 15 und 60 Tagen');
  });

  it('kein „Frist" mehr — der Wert ist ein Alter, kein Termin', () => {
    const parts = formatHomeSubtitle({ offen: 9, kritisch: 4, warnung: 2 }, S);
    expect(`${parts.kritisch} ${parts.warnung}`).not.toMatch(/Frist/i);
  });
});
