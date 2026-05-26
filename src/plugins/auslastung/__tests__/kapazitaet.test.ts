/**
 * Unit-Tests fuer kapazitaet.ts (v2.4 — Single-Source-of-Truth-Modell).
 *
 * Drei Schwerpunkte:
 *  1. `computeKapazitaet` — konsumiert `MaQuartalsAuslastung` (fest + pending).
 *  2. `kapazitaetsScore` — Banden + Quartals-Ende-Bonus (unveraendert).
 *  3. `tageImQuartal` — Datums-Helfer (unveraendert).
 */
import { describe, it, expect } from 'vitest';
import {
  computeKapazitaet,
  kapazitaetsScore,
  tageImQuartal,
} from '../services/kapazitaet';
import {
  EMPTY_AUSLASTUNG,
  type MaQuartalsAuslastung,
  type MaQuartalsBucket,
} from '../services/quartals-auslastung';
import { DEFAULT_AUSLASTUNG_CONFIG, type AnonymerMitarbeiter } from '../types';

function makeMa(overrides: Partial<AnonymerMitarbeiter> = {}): AnonymerMitarbeiter {
  return {
    anonId: 'MA01',
    jahresKapazitaet: 800,
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie: 'IT',
    nebenKategorien: [],
    abschlagProzent: 0,
    ueberKategorien: ['IT'],
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
    ...overrides,
  };
}

function makeBucket(overrides: Partial<MaQuartalsBucket> = {}): MaQuartalsBucket {
  return {
    antraege: 0,
    tvs: 0,
    stunden: 0,
    aktenzeichenSet: new Set<string>(),
    verbuende: [],
    ...overrides,
  };
}

function makeAuslastung(
  fest: Partial<MaQuartalsBucket> = {},
  pending: Partial<MaQuartalsBucket> = {},
): MaQuartalsAuslastung {
  return { fest: makeBucket(fest), pending: makeBucket(pending) };
}

describe('computeKapazitaet', () => {
  it('leere Auslastung (undefined) → kein Verbrauch, alles frei', () => {
    const ma = makeMa();
    const v = computeKapazitaet(ma, undefined, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.effektivStunden).toBe(200);
    expect(v.verbrauchteStunden).toBe(0);
    expect(v.restStunden).toBe(200);
    expect(v.restTVs).toBe(22);  // floor(200 / 9)
    expect(v.fest.antraege).toBe(0);
    expect(v.pending.antraege).toBe(0);
    expect(v.ueberbuchung).toBe(0);
  });

  it('EMPTY_AUSLASTUNG → identisch zu undefined', () => {
    const ma = makeMa();
    const a = computeKapazitaet(ma, undefined, DEFAULT_AUSLASTUNG_CONFIG);
    const b = computeKapazitaet(ma, EMPTY_AUSLASTUNG, DEFAULT_AUSLASTUNG_CONFIG);
    expect(a.restStunden).toBe(b.restStunden);
    expect(a.restTVs).toBe(b.restTVs);
  });

  it('25% Abschlag → effektivStunden auf 75% der Quartals-Kap', () => {
    const ma = makeMa({ abschlagProzent: 25 });
    const v = computeKapazitaet(ma, undefined, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.effektivStunden).toBe(150);
    expect(v.restTVs).toBe(16); // floor(150 / 9)
  });

  it('fest-Bucket: 1 Verbund mit 4 TVs', () => {
    const ma = makeMa();
    const a = makeAuslastung({ antraege: 1, tvs: 4, stunden: 36 });
    const v = computeKapazitaet(ma, a, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.fest.antraege).toBe(1);
    expect(v.fest.tvs).toBe(4);
    expect(v.fest.stunden).toBe(36);
    expect(v.verbrauchteStunden).toBe(36);
    expect(v.restStunden).toBe(164);
    expect(v.restTVs).toBe(18); // floor(164 / 9)
  });

  it('pending-Bucket: 2 Einzelanträge', () => {
    const ma = makeMa();
    const a = makeAuslastung({}, { antraege: 2, tvs: 2, stunden: 18 });
    const v = computeKapazitaet(ma, a, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.fest.stunden).toBe(0);
    expect(v.pending.antraege).toBe(2);
    expect(v.verbrauchteStunden).toBe(18);
    expect(v.restStunden).toBe(182);
  });

  it('fest + pending summieren sich', () => {
    const ma = makeMa();
    const a = makeAuslastung(
      { antraege: 1, tvs: 4, stunden: 36 },
      { antraege: 1, tvs: 1, stunden: 9 },
    );
    const v = computeKapazitaet(ma, a, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.verbrauchteStunden).toBe(45);
    expect(v.restStunden).toBe(155);
    expect(v.restTVs).toBe(17); // floor(155 / 9)
  });

  it('Ueberbuchung: verbraucht > effektiv', () => {
    const ma = makeMa({ jahresKapazitaet: 100 });  // 25 h/Q
    const a = makeAuslastung({ antraege: 1, tvs: 4, stunden: 36 });
    const v = computeKapazitaet(ma, a, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.effektivStunden).toBe(25);
    expect(v.restStunden).toBe(-11);
    expect(v.ueberbuchung).toBe(11);
    expect(v.restTVs).toBe(0);  // max(0, -11)/9 = 0
  });

  it('Abschlag 100% → effektivStunden = 0', () => {
    const ma = makeMa({ abschlagProzent: 100 });
    const a = makeAuslastung({ antraege: 1, tvs: 1, stunden: 9 });
    const v = computeKapazitaet(ma, a, DEFAULT_AUSLASTUNG_CONFIG);
    expect(v.effektivStunden).toBe(0);
    expect(v.restStunden).toBe(-9);
    expect(v.ueberbuchung).toBe(9);
  });

  it('config.stundenProTV=12 → restTVs entsprechend', () => {
    const ma = makeMa();
    const config = { ...DEFAULT_AUSLASTUNG_CONFIG, stundenProTV: 12 };
    const v = computeKapazitaet(ma, undefined, config);
    expect(v.restTVs).toBe(16); // floor(200 / 12)
  });
});

describe('kapazitaetsScore', () => {
  it('ratio >= 1.5 → 1.0 (reichlich Luft)', () => {
    expect(kapazitaetsScore(100, 50, 50)).toBe(1.0);
    expect(kapazitaetsScore(200, 18, 50)).toBe(1.0);
  });

  it('ratio = 1.0 → 0.8', () => {
    expect(kapazitaetsScore(18, 18, 50)).toBeCloseTo(0.8, 5);
  });

  it('ratio = 0.5 → 0.5', () => {
    expect(kapazitaetsScore(9, 18, 50)).toBeCloseTo(0.5, 5);
  });

  it('ratio = 0.0 → 0.2', () => {
    expect(kapazitaetsScore(0, 18, 50)).toBeCloseTo(0.2, 5);
  });

  it('ratio < 0 (ueberbucht) → min 0.05', () => {
    expect(kapazitaetsScore(-1000, 18, 50)).toBeGreaterThanOrEqual(0.05);
    expect(kapazitaetsScore(-9, 18, 50)).toBeGreaterThan(0);
  });

  it('Quartals-Ende-Bonus', () => {
    const ohneBonus = kapazitaetsScore(0, 18, 50, 21);
    const mitBonus = kapazitaetsScore(0, 18, 10, 21);
    expect(mitBonus).toBeGreaterThan(ohneBonus);
    expect(mitBonus - ohneBonus).toBeCloseTo((21 - 10) / 21 * 0.15, 4);
  });

  it('Score nie ueber 1.0 auch bei sehr starkem Bonus', () => {
    expect(kapazitaetsScore(1000, 18, 0, 21)).toBeLessThanOrEqual(1.0);
  });

  it('benoetigt = 0 → score 1.0', () => {
    expect(kapazitaetsScore(10, 0, 50)).toBe(1.0);
  });
});

describe('tageImQuartal', () => {
  it('Q2 2026, heute Mitte April → 75-80 Tage', () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);
    const days = tageImQuartal('2026-Q2', now);
    expect(days).toBeGreaterThanOrEqual(75);
    expect(days).toBeLessThanOrEqual(80);
  });

  it('heute = Quartals-Ende → 0 oder 1', () => {
    const now = new Date(2026, 5, 30, 23, 50, 0);
    expect(tageImQuartal('2026-Q2', now)).toBeLessThanOrEqual(1);
  });

  it('Quartal in der Vergangenheit → 0', () => {
    const now = new Date(2026, 5, 15);
    expect(tageImQuartal('2026-Q1', now)).toBe(0);
  });

  it('Quartals-Format ungueltig → 0', () => {
    expect(tageImQuartal('foo')).toBe(0);
    expect(tageImQuartal('2026-Q5')).toBe(0);
    expect(tageImQuartal('')).toBe(0);
  });
});
