import { describe, it, expect } from 'vitest';
import {
  FILTER_EMPTY_LABEL, jahrGruppe, monatsFilterLabel, monatsWert, monatsWertOderLeer,
  neuesteZuerst,
} from '../spaltenFilterWerte';

describe('monatsWert', () => {
  it('liest beide Schreibweisen, die im Export nebeneinander vorkommen', () => {
    expect(monatsWert('13.08.2024')).toBe('2024-08');
    expect(monatsWert('2024-08-13')).toBe('2024-08');
    expect(monatsWert('2024-08-13T03:00:00')).toBe('2024-08');
  });

  it('polstert einstellige Monate — sonst sortierte 2024-9 vor 2024-10', () => {
    expect(monatsWert('05.09.2024')).toBe('2024-09');
    expect(monatsWert('5.9.2024')).toBe('2024-09');
  });

  it('liefert leer, wo kein ganzer Datumswert steht', () => {
    expect(monatsWert(undefined)).toBe('');
    expect(monatsWert('')).toBe('');
    expect(monatsWert('16KN123456')).toBe('');
  });
});

describe('monatsWertOderLeer', () => {
  it('macht Zeilen ohne Datum als Sentinel waehlbar', () => {
    // Ohne den Sentinel ueberspringt `deriveFilterCandidates` den leeren String
    // und die Zeilen fielen still aus der Tabelle, sobald etwas angehakt ist.
    expect(monatsWertOderLeer('')).toBe(FILTER_EMPTY_LABEL);
    expect(monatsWertOderLeer(undefined)).toBe(FILTER_EMPTY_LABEL);
    expect(monatsWertOderLeer('13.08.2024')).toBe('2024-08');
  });
});

describe('monatsFilterLabel', () => {
  it('beschriftet den Monat deutsch', () => {
    expect(monatsFilterLabel('2024-01')).toBe('Januar');
    expect(monatsFilterLabel('2024-08')).toBe('August');
    expect(monatsFilterLabel('2024-12')).toBe('Dezember');
  });

  it('laesst durch, was kein Monatswert ist', () => {
    expect(monatsFilterLabel(FILTER_EMPTY_LABEL)).toBe(FILTER_EMPTY_LABEL);
    expect(monatsFilterLabel('2024-13')).toBe('2024-13');
  });
});

describe('jahrGruppe', () => {
  it('gruppiert nach Jahr, der Sentinel gehoert in keine Gruppe', () => {
    expect(jahrGruppe('2024-08')).toBe('2024');
    expect(jahrGruppe(FILTER_EMPTY_LABEL)).toBeNull();
  });
});

describe('neuesteZuerst', () => {
  it('sortiert Jahre UND Monate absteigend, Sentinel zuletzt', () => {
    const werte = ['2023-12', FILTER_EMPTY_LABEL, '2024-07', '2024-08', '2022-01'];
    expect([...werte].sort(neuesteZuerst)).toEqual([
      '2024-08', '2024-07', '2023-12', '2022-01', FILTER_EMPTY_LABEL,
    ]);
  });

  it('haelt den Sentinel auch dann unten, wenn er vorne steht', () => {
    expect([FILTER_EMPTY_LABEL, '2020-01'].sort(neuesteZuerst))
      .toEqual(['2020-01', FILTER_EMPTY_LABEL]);
  });
});
