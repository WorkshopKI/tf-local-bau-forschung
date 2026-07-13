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

  it('fällt bei NaN/Infinity auf den Default (260px) zurück', () => {
    expect(clampSeiteBreite(Number.NaN)).toBe(260);
    expect(clampSeiteBreite(Number.POSITIVE_INFINITY)).toBe(260);
    expect(clampSeiteBreite(Number('abc'))).toBe(260);
  });
});
