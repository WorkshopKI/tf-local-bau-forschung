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
import { verknuepfungAlsThreshold } from '../useSuchVerknuepfung';

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
});
