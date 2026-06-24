import { describe, it, expect } from 'vitest';
import { parseEuroish, formatEuro, formatDateish } from '../format';

describe('parseEuroish', () => {
  it('parst deutsche Tausender + Währungssymbol', () => {
    expect(parseEuroish('280.000 €')).toBe(280000);
    expect(parseEuroish('1.543.436')).toBe(1543436);
    expect(parseEuroish('280000')).toBe(280000);
    expect(parseEuroish(424889)).toBe(424889);
  });
  it('null bei ziffernlosem/leerem Input', () => {
    expect(parseEuroish('—')).toBeNull();
    expect(parseEuroish('')).toBeNull();
    expect(parseEuroish(null)).toBeNull();
  });
});

describe('formatEuro', () => {
  it('formatiert deutsch mit €-Suffix', () => {
    expect(formatEuro(1543436)).toBe('1.543.436 €');
  });
});

describe('formatDateish', () => {
  it('ISO → deutsch, bereits deutsch bleibt, leer → null', () => {
    expect(formatDateish('2026-02-24')).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(formatDateish('2026-02-24')).toContain('2026');
    expect(formatDateish('24.02.2026')).toBe('24.02.2026');
    expect(formatDateish('')).toBeNull();
    expect(formatDateish(null)).toBeNull();
  });
});
