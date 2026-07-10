import { describe, it, expect } from 'vitest';
import { paare, metriken, fasseZusammen, fehlzuordnungen } from '../aspekte-metrik';

describe('aspekte-metrik', () => {
  describe('metriken (partielles Goldset)', () => {
    it('Prediction auf NICHT annotierter Sektion zählt nicht als Fehler', () => {
      const gold = { 'k-1': ['A'], 'k-7': ['F'] };
      const pred = { 'k-1': ['A'], 'k-7': ['F'], 'k-5': ['C'] }; // k-5 nicht im Goldset
      const m = metriken(gold, pred);
      expect(m.precision).toBe(1);
      expect(m.recall).toBe(1);
      expect(m.f1).toBe(1);
      expect(m.predAufGold).toBe(2); // k-5|C ist ausgeschlossen
    });

    it('Fehlzuordnung senkt Precision und Recall', () => {
      const m = metriken({ 'k-1': ['A'], 'k-7': ['F'] }, { 'k-1': ['A'], 'k-7': ['E'] });
      expect(m.treffer).toBe(1);
      expect(m.precision).toBeCloseTo(0.5);
      expect(m.recall).toBeCloseTo(0.5);
    });

    it('leere Prediction → Recall 0, Precision 1 (leerer Nenner), F1 0', () => {
      const m = metriken({ 'k-1': ['A'] }, {});
      expect(m.recall).toBe(0);
      expect(m.precision).toBe(1);
      expect(m.f1).toBe(0);
    });
  });

  describe('fasseZusammen', () => {
    it('Makro (Mittel je Fixture) + Mikro (gepoolt)', () => {
      const a = metriken({ 'k-1': ['A'] }, { 'k-1': ['A'] });                  // P=R=1
      const b = metriken({ 'k-1': ['A'], 'k-2': ['B'] }, { 'k-1': ['A'] });    // P=1 R=0.5
      const z = fasseZusammen([a, b]);
      expect(z.fixtures).toBe(2);
      expect(z.makroPrecision).toBeCloseTo(1);
      expect(z.makroRecall).toBeCloseTo(0.75);
      expect(z.mikroPrecision).toBeCloseTo(1);      // treffer 2 / predAufGold 2
      expect(z.mikroRecall).toBeCloseTo(2 / 3);     // treffer 2 / goldPaare 3
    });

    it('leer → Nullen (Makro) bzw. 1er-Fallback (Mikro) — wie die CLI', () => {
      const z = fasseZusammen([]);
      expect(z.fixtures).toBe(0);
      expect(z.makroPrecision).toBe(0);
      expect(z.makroRecall).toBe(0);
      expect(z.mikroPrecision).toBe(1);
      expect(z.mikroRecall).toBe(1);
    });
  });

  describe('fehlzuordnungen', () => {
    it('nur abweichende Sektionen, Format „k-7: erwartet F, erhalten E"', () => {
      const gold = { 'k-1': ['A'], 'k-7': ['F'], 'k-11': ['I', 'J'] };
      const pred = { 'k-1': ['A'], 'k-7': ['E'], 'k-11': ['J', 'I'] }; // k-11 nur Reihenfolge → gleich
      expect(fehlzuordnungen(gold, pred)).toEqual(['k-7: erwartet F, erhalten E']);
    });

    it('fehlende Prediction → „erhalten –"', () => {
      expect(fehlzuordnungen({ 'k-1': ['A'] }, {})).toEqual(['k-1: erwartet A, erhalten –']);
    });
  });

  it('paare bildet sid|A-Strings', () => {
    expect([...paare({ 'k-1': ['A', 'B'] })].sort()).toEqual(['k-1|A', 'k-1|B']);
  });
});
