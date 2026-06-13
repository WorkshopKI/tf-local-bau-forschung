/**
 * Tests fuer buildManualMatch — die synthetische MatchResult fuer einen von der
 * PL manuell hinzugefuegten MA. Kein Score, aber korrekte Kapazitaets-/
 * Kontingent-Angaben (gleiche Helfer wie die Engine).
 */
import { describe, it, expect } from 'vitest';
import { buildManualMatch } from '../services/matching';
import type { AnonymerMitarbeiter, AuslastungConfig } from '../types';

function makeMa(overrides: Partial<AnonymerMitarbeiter> = {}): AnonymerMitarbeiter {
  return {
    anonId: 'MA01',
    jahresKapazitaet: 0,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IT',
    nebenKategorien: [],
    abschlagProzent: 0,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
    jahresKapazitaetProTyp: { FuE: 360 },
    ...overrides,
  };
}

const config = { stundenProTV: 9 } as AuslastungConfig;

describe('buildManualMatch', () => {
  it('setzt manuell=true und alle Score-Felder auf 0', () => {
    const m = buildManualMatch(makeMa(), 'FuE', undefined, undefined, config, 18);
    expect(m.manuell).toBe(true);
    expect(m.bm25Score).toBe(0);
    expect(m.embeddingScore).toBe(0);
    expect(m.kompetenzScore).toBe(0);
    expect(m.finalScore).toBe(0);
    expect(m.anonId).toBe('MA01');
    expect(m.benoetigteStunden).toBe(18);
  });

  it('füllt Kapazität aus computeKapazitaet (360 h/Jahr FuE → 90 h/Quartal, nichts verbraucht)', () => {
    const m = buildManualMatch(makeMa(), 'FuE', undefined, undefined, config, 18);
    expect(m.quartalsKapazitaet).toBeCloseTo(90);   // 360 × 1 / 4
    expect(m.restKapazitaet).toBeCloseTo(90);       // kein Verbrauch
    expect(m.ueberbuchung).toBe(0);
  });

  it('füllt Typ-Kontingent (90 h/Quartal ÷ 9 h/TV = 10 TVs, 0 verbraucht)', () => {
    const m = buildManualMatch(makeMa(), 'FuE', undefined, undefined, config, 18);
    expect(m.kontingentQuartal).toBeCloseTo(10);
    expect(m.kontingentRest).toBeCloseTo(10);
  });

  it('ohne Typ-Kontingent (Bucket null) → kein Kontingent-Limit', () => {
    const m = buildManualMatch(makeMa({ jahresKapazitaetProTyp: {} }), null, undefined, undefined, config, 9);
    expect(m.kontingentQuartal).toBeUndefined();
    expect(m.kontingentRest).toBeUndefined();
    expect(m.quartalsKapazitaet).toBe(0);
  });
});
