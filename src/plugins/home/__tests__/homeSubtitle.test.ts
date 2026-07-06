import { describe, it, expect } from 'vitest';
import { formatHomeSubtitle } from '../homeSubtitle';

describe('formatHomeSubtitle — Mockup-Fall', () => {
  it('47 / 38 / 9 (== Ampel-Karten-Zahlen)', () => {
    expect(formatHomeSubtitle({ offen: 47, kritisch: 38, warnung: 9 })).toEqual({
      offen: '47 offene Vorgänge',
      kritisch: '38 über der 90-Tage-Frist',
      warnung: '9 nähern sich',
    });
  });
});

describe('formatHomeSubtitle — Singular/Plural', () => {
  it('offen === 1 → Singular „offener Vorgang"', () => {
    expect(formatHomeSubtitle({ offen: 1, kritisch: 0, warnung: 0 }).offen).toBe('1 offener Vorgang');
  });
  it('offen === 2 → Plural „offene Vorgänge"', () => {
    expect(formatHomeSubtitle({ offen: 2, kritisch: 0, warnung: 0 }).offen).toBe('2 offene Vorgänge');
  });
  it('offen === 0 → Plural „offene Vorgänge"', () => {
    expect(formatHomeSubtitle({ offen: 0, kritisch: 0, warnung: 0 }).offen).toBe('0 offene Vorgänge');
  });
});

describe('formatHomeSubtitle — Null-Teile bei Zähler 0', () => {
  it('kritisch === 0 ∧ warnung === 0 → nur offen', () => {
    const parts = formatHomeSubtitle({ offen: 12, kritisch: 0, warnung: 0 });
    expect(parts.kritisch).toBeNull();
    expect(parts.warnung).toBeNull();
    expect(parts.offen).toBe('12 offene Vorgänge');
  });
  it('nur kritisch → warnung-Teil entfällt', () => {
    const parts = formatHomeSubtitle({ offen: 5, kritisch: 3, warnung: 0 });
    expect(parts.kritisch).toBe('3 über der 90-Tage-Frist');
    expect(parts.warnung).toBeNull();
  });
  it('nur warnung → kritisch-Teil entfällt', () => {
    const parts = formatHomeSubtitle({ offen: 5, kritisch: 0, warnung: 2 });
    expect(parts.kritisch).toBeNull();
    expect(parts.warnung).toBe('2 nähern sich');
  });
});

describe('formatHomeSubtitle — de-DE-Zahlformat', () => {
  it('Tausender-Trennzeichen', () => {
    expect(formatHomeSubtitle({ offen: 1500, kritisch: 1234, warnung: 0 })).toMatchObject({
      offen: '1.500 offene Vorgänge',
      kritisch: '1.234 über der 90-Tage-Frist',
    });
  });
});
