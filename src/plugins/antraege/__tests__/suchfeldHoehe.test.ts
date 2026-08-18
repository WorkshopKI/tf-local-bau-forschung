/**
 * Die gemerkte Höhe des Frage-Feldes (v4.108).
 *
 * Ein Wert aus dem Speicher überlebt Umbenennungen, fremde Schreiber und jeden
 * Tippfehler im Entwicklerwerkzeug — geprüft wird deshalb der Rand, nicht der
 * Normalfall.
 */
import { describe, it, expect } from 'vitest';
import { leseHoehe } from '../SuchFeld';

describe('leseHoehe', () => {
  it('nimmt eine Höhe innerhalb der Grenzen', () => {
    expect(leseHoehe('96')).toBe(96);
    expect(leseHoehe('32')).toBe(32);
    expect(leseHoehe('240')).toBe(240);
  });

  it('verwirft, was kleiner als eine Zeile oder größer als der Deckel ist', () => {
    expect(leseHoehe('31')).toBeNull();
    expect(leseHoehe('241')).toBeNull();
    expect(leseHoehe('5000')).toBeNull();
  });

  it('verwirft Unlesbares statt NaN durchzureichen', () => {
    expect(leseHoehe(null)).toBeNull();
    expect(leseHoehe('')).toBeNull();
    expect(leseHoehe('hoch')).toBeNull();
    expect(leseHoehe('96px')).toBeNull();
  });
});
