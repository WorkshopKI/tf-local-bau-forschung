/**
 * Verknüpfung → Orama-`threshold` (v3.50).
 *
 * Die Zuordnung ist winzig und genau deshalb prüfenswert: Orama kennt keine
 * Booleschen Operatoren, `threshold` ist die einzige Stellschraube, und seine
 * Bedeutung liest sich verkehrt herum — 0 heißt „alle Tokens", 1 heißt
 * „irgendeines". Ein vertauschtes Paar sähe im UI aus wie eine Suche, die
 * einfach zu viel oder zu wenig findet.
 */
import { describe, it, expect } from 'vitest';
import {
  verknuepfungAlsThreshold,
  parseVerknuepfung,
  VERKNUEPFUNG_LABEL,
  VERKNUEPFUNG_OPERATOR,
  type SuchVerknuepfung,
} from '../useSuchVerknuepfung';

const ALLE: SuchVerknuepfung[] = ['und', 'oder', 'wortfolge'];

describe('verknuepfungAlsThreshold', () => {
  it('UND = 0 (nur Dokumente mit ALLEN Wörtern)', () => {
    expect(verknuepfungAlsThreshold('und')).toBe(0);
  });

  it('ODER = 1 (irgendeines genügt — Oramas Laufzeit-Default)', () => {
    expect(verknuepfungAlsThreshold('oder')).toBe(1);
  });

  it('UND ist strenger als ODER', () => {
    expect(verknuepfungAlsThreshold('und')).toBeLessThan(verknuepfungAlsThreshold('oder'));
  });

  it('Wortfolge verlangt im Index ebenfalls alle Wörter', () => {
    // Orama hat keine Phrasensuche. Die Reihenfolge prüft erst der
    // Wortlaut-Pfad; für Dokumente heißt „Wortfolge" ehrlich „alle Wörter".
    expect(verknuepfungAlsThreshold('wortfolge')).toBe(verknuepfungAlsThreshold('und'));
  });
});

describe('parseVerknuepfung', () => {
  it('liest die drei bekannten Werte', () => {
    for (const v of ALLE) expect(parseVerknuepfung(v)).toBe(v);
  });

  it('fällt bei Unbekanntem und bei nichts auf UND zurück', () => {
    expect(parseVerknuepfung(null)).toBe('und');
    expect(parseVerknuepfung('phrase')).toBe('und');
    expect(parseVerknuepfung('')).toBe('und');
  });
});

describe('Beschriftungen', () => {
  it('jede Verknüpfung hat Label und Operator', () => {
    for (const v of ALLE) {
      expect(VERKNUEPFUNG_LABEL[v].length).toBeGreaterThan(0);
      expect(VERKNUEPFUNG_OPERATOR[v].length).toBeGreaterThan(0);
    }
  });

  it('die Beschriftungen sind unterscheidbar', () => {
    expect(new Set(Object.values(VERKNUEPFUNG_LABEL)).size).toBe(ALLE.length);
  });
});
