/**
 * Tests fuer externe-zuweisungen.ts.
 *
 * Bis v2.3 enthielt dieses Modul mehrere Funktionen zur Master-CSV-
 * Auswertung. Ab v2.4 ist nur noch `dateToQuartal` uebrig — der Rest ist
 * in `quartals-auslastung.ts` zusammengefasst (siehe dortige Tests).
 */
import { describe, it, expect } from 'vitest';
import { dateToQuartal, previousTwoQuartals } from '../services/verbund';

describe('dateToQuartal', () => {
  it('ISO-Date "YYYY-MM-DD" → Quartal', () => {
    expect(dateToQuartal('2026-01-15')).toBe('2026-Q1');
    expect(dateToQuartal('2026-03-31')).toBe('2026-Q1');
    expect(dateToQuartal('2026-04-01')).toBe('2026-Q2');
    expect(dateToQuartal('2026-06-30')).toBe('2026-Q2');
    expect(dateToQuartal('2026-07-01')).toBe('2026-Q3');
    expect(dateToQuartal('2026-09-30')).toBe('2026-Q3');
    expect(dateToQuartal('2026-10-01')).toBe('2026-Q4');
    expect(dateToQuartal('2026-12-31')).toBe('2026-Q4');
  });

  it('Slash-Separator "YYYY/MM/DD" → Quartal', () => {
    expect(dateToQuartal('2026/04/15')).toBe('2026-Q2');
  });

  it('führende/trailing Whitespace toleriert', () => {
    expect(dateToQuartal('  2026-04-15  ')).toBe('2026-Q2');
  });

  it('undefined/null/empty → null', () => {
    expect(dateToQuartal(undefined)).toBeNull();
    expect(dateToQuartal(null)).toBeNull();
    expect(dateToQuartal('')).toBeNull();
    expect(dateToQuartal('   ')).toBeNull();
  });

  it('ungültiges Format → null', () => {
    expect(dateToQuartal('15.04.2026')).toBeNull();
    expect(dateToQuartal('foo')).toBeNull();
    expect(dateToQuartal('2026')).toBeNull();
    expect(dateToQuartal('2026-04')).toBeNull();
  });

  it('ungültiger Monat → null', () => {
    expect(dateToQuartal('2026-00-15')).toBeNull();
    expect(dateToQuartal('2026-13-15')).toBeNull();
  });
});

describe('previousTwoQuartals', () => {
  it('Q2 → [Q4 Vorjahr, Q1]', () => {
    expect(previousTwoQuartals('2026-Q2')).toEqual(['2025-Q4', '2026-Q1']);
  });

  it('Q1 → [Q3 Vorjahr, Q4 Vorjahr]', () => {
    expect(previousTwoQuartals('2026-Q1')).toEqual(['2025-Q3', '2025-Q4']);
  });

  it('Q3 → [Q1, Q2]', () => {
    expect(previousTwoQuartals('2026-Q3')).toEqual(['2026-Q1', '2026-Q2']);
  });

  it('Q4 → [Q2, Q3]', () => {
    expect(previousTwoQuartals('2026-Q4')).toEqual(['2026-Q2', '2026-Q3']);
  });

  it('Jahres-Wechsel an Q1/Q2 sauber', () => {
    expect(previousTwoQuartals('2027-Q1')).toEqual(['2026-Q3', '2026-Q4']);
    expect(previousTwoQuartals('2027-Q2')).toEqual(['2026-Q4', '2027-Q1']);
  });

  it('ungültiges Format → null', () => {
    expect(previousTwoQuartals('2026-Q5')).toBeNull();
    expect(previousTwoQuartals('2026-Q0')).toBeNull();
    expect(previousTwoQuartals('Q2')).toBeNull();
    expect(previousTwoQuartals('2026')).toBeNull();
    expect(previousTwoQuartals('')).toBeNull();
  });
});
