/**
 * Reine Klemm-Logik der ziehbaren Zwei-Spalten-Breite. Die Zieh-Interaktion
 * selbst (Pointer/DOM) ist in der node-only Suite nicht testbar.
 */
import { describe, expect, it } from 'vitest';
import { clampBreite } from '../zweiSpaltenResize-logic';

describe('clampBreite', () => {
  it('klemmt unter das Minimum', () => {
    expect(clampBreite(50, 200, 480, 260)).toBe(200);
    expect(clampBreite(279, 280, 560, 320)).toBe(280);
  });

  it('klemmt über das Maximum', () => {
    expect(clampBreite(9999, 200, 480, 260)).toBe(480);
    expect(clampBreite(600, 280, 560, 320)).toBe(560);
  });

  it('rundet Werte im Bereich', () => {
    expect(clampBreite(260, 200, 480, 260)).toBe(260);
    expect(clampBreite(300.6, 200, 480, 260)).toBe(301);
    expect(clampBreite(320, 280, 560, 320)).toBe(320);
  });

  it('fällt bei NaN/Infinity auf den Default zurück', () => {
    expect(clampBreite(Number.NaN, 200, 480, 260)).toBe(260);
    expect(clampBreite(Number.POSITIVE_INFINITY, 280, 560, 320)).toBe(320);
    expect(clampBreite(Number('abc'), 200, 480, 260)).toBe(260);
  });
});
