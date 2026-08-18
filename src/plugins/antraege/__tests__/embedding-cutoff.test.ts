/**
 * Tests für die adaptive Embedding-Schwelle (v2.62.4).
 *
 * Hintergrund: Die starre 0.55-Schwelle ließ die Ähnlichkeitssuche auf dem
 * v2-Korpus tot wirken — pl-Echtdaten-Messung: Query „Bilderkennung" (eindeutig
 * relevante Treffer vorhanden) erreichte als beste Cosine nur 0.437 → 0 Treffer.
 * Der Cutoff ist jetzt max(Floor 0.35, 85% der besten Cosine des Laufs) — die
 * 90 % liessen seit v4.110 zu wenig durch (Messtabelle im Service).
 */
import { describe, it, expect } from 'vitest';
import { computeEmbeddingCutoff } from '../services/antraege-search-service';

describe('computeEmbeddingCutoff', () => {
  it('Floor dominiert bei schwacher bester Cosine (Garbage-Query → 0 Treffer)', () => {
    expect(computeEmbeddingCutoff(0.2)).toBeCloseTo(0.35, 10);
    // beste Cosine unterm Floor → Cutoff über ihr → kein Treffer überlebt.
    expect(computeEmbeddingCutoff(0.2)).toBeGreaterThan(0.2);
  });

  it('Relativ-Anteil dominiert bei starker bester Cosine (enges Qualitäts-Band)', () => {
    expect(computeEmbeddingCutoff(0.7)).toBeCloseTo(0.595, 10);
  });

  it('Regression pl-Echtdaten: beste Cosine 0.437 („Bilderkennung") überlebt den Cutoff', () => {
    const cutoff = computeEmbeddingCutoff(0.437);
    expect(cutoff).toBeCloseTo(Math.max(0.35, 0.437 * 0.85), 10);
    expect(0.437).toBeGreaterThanOrEqual(cutoff);
  });
});
