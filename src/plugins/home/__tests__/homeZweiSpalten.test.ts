/**
 * Trenn-Griff der Startseite: die Seitenspalten-Breite wird geklemmt
 * (200–480px) und robust geparst. Reiner Helfer — die Zieh-Interaktion selbst
 * (Pointer/DOM) ist in der node-only Suite nicht testbar.
 */
import { describe, expect, it } from 'vitest';
import { clampSeiteBreite } from '../HomeZweiSpalten';

describe('clampSeiteBreite', () => {
  it('klemmt unter das Minimum (200px)', () => {
    expect(clampSeiteBreite(50)).toBe(200);
    expect(clampSeiteBreite(199)).toBe(200);
  });

  it('klemmt über das Maximum (480px)', () => {
    expect(clampSeiteBreite(9999)).toBe(480);
    expect(clampSeiteBreite(481)).toBe(480);
  });

  it('rundet Werte im Bereich', () => {
    expect(clampSeiteBreite(260)).toBe(260);
    expect(clampSeiteBreite(300.6)).toBe(301);
  });

  // Default 260 → 300 (v2.372.2): bei 260 schnitt die Spalte den eigenen
  // Widget-Titel ab („Antragseing…").
  it('fällt bei NaN/Infinity auf den Default (300px) zurück', () => {
    expect(clampSeiteBreite(Number.NaN)).toBe(300);
    expect(clampSeiteBreite(Number.POSITIVE_INFINITY)).toBe(300);
    expect(clampSeiteBreite(Number('abc'))).toBe(300);
  });
});
