/**
 * Tests für die Screenshot-Skalierungs-Mathematik (v2.42). Nur die pure Funktion
 * `computeScaledSize` — der eigentliche Canvas-Resize läuft nur im Browser.
 */
import { describe, expect, it } from 'vitest';
import { computeScaledSize, MAX_ATTACHMENT_WIDTH } from '../feedbackAttachments';

describe('computeScaledSize', () => {
  it('lässt Bilder ≤ maxW unverändert', () => {
    expect(computeScaledSize(1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(computeScaledSize(MAX_ATTACHMENT_WIDTH, 900)).toEqual({ width: 1600, height: 900 });
  });

  it('skaliert breitere Bilder auf maxW, Seitenverhältnis bleibt', () => {
    const r = computeScaledSize(3200, 1800);
    expect(r.width).toBe(MAX_ATTACHMENT_WIDTH);
    expect(r.height).toBe(900); // 1800 * (1600/3200)
    expect(r.height / r.width).toBeCloseTo(1800 / 3200, 5);
  });

  it('typischer 2560×1440-Screenshot → 1600×900', () => {
    expect(computeScaledSize(2560, 1440)).toEqual({ width: 1600, height: 900 });
  });

  it('rundet die Höhe auf ganze Pixel', () => {
    const r = computeScaledSize(1000, 333, 400);
    expect(r.width).toBe(400);
    expect(r.height).toBe(133); // round(333 * 0.4) = 133
  });
});
