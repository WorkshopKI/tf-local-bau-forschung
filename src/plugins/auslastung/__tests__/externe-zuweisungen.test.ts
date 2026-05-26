/**
 * Tests fuer externe-zuweisungen.ts.
 *
 * Bis v2.3 enthielt dieses Modul mehrere Funktionen zur Master-CSV-
 * Auswertung. Ab v2.4 ist nur noch `dateToQuartal` uebrig — der Rest ist
 * in `quartals-auslastung.ts` zusammengefasst (siehe dortige Tests).
 */
import { describe, it, expect } from 'vitest';
import { dateToQuartal } from '../services/externe-zuweisungen';

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
