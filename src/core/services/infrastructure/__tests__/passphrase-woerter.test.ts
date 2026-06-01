/**
 * Unit-Tests fuer die Passphrase-Wortliste + Generator (v2.11).
 */
import { describe, it, expect } from 'vitest';
import { PASSPHRASE_WOERTER, generatePassphrase } from '../passphrase-woerter';

describe('PASSPHRASE_WOERTER', () => {
  it('hat genug Woerter fuer ausreichend Entropie (>= 300)', () => {
    expect(PASSPHRASE_WOERTER.length).toBeGreaterThanOrEqual(300);
  });

  it('enthaelt nur ASCII-Buchstaben (keine Umlaute / kein ß)', () => {
    const bad = PASSPHRASE_WOERTER.filter(w => !/^[A-Za-z]+$/.test(w));
    expect(bad).toEqual([]);
  });

  it('hat keine Duplikate', () => {
    expect(new Set(PASSPHRASE_WOERTER).size).toBe(PASSPHRASE_WOERTER.length);
  });
});

describe('generatePassphrase', () => {
  it('liefert zwei verschiedene Woerter aus der Liste, "-"-getrennt', () => {
    const set = new Set(PASSPHRASE_WOERTER);
    for (let i = 0; i < 500; i++) {
      const pp = generatePassphrase();
      const parts = pp.split('-');
      expect(parts).toHaveLength(2);
      expect(set.has(parts[0]!)).toBe(true);
      expect(set.has(parts[1]!)).toBe(true);
      expect(parts[0]).not.toBe(parts[1]);
    }
  });
});
