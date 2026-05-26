/**
 * Unit-Tests fuer kapazitaet.ts.
 *
 * Drei Schwerpunkte:
 *  1. `computeKapazitaet` — Stunden- und Antrags-Sicht, inkl. Abschlag und
 *     Ueberbuchung.
 *  2. `kapazitaetsScore` — Banden + Quartals-Ende-Bonus.
 *  3. `tageImQuartal` — Datums-Helfer.
 */
import { describe, it, expect } from 'vitest';
import {
  computeKapazitaet,
  kapazitaetsScore,
  tageImQuartal,
} from '../services/kapazitaet';
import { DEFAULT_AUSLASTUNG_CONFIG, type AnonymerMitarbeiter, type Zuweisung } from '../types';

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

function makeZuweisung(overrides: Partial<Zuweisung> = {}): Zuweisung {
  return {
    antragId: '16DS261161',
    anonId: 'MA01',
    quartal: '2026-Q2',
    stunden: 18,
    status: 'freigegeben',
    ...overrides,
  };
}

describe('computeKapazitaet', () => {
  it('800 h/Jahr ohne Abschlag, 2 TV/Antrag, 9 h/TV → maxAntraege=11', () => {
    const ma = makeMa();
    const v = computeKapazitaet(ma, [], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.effektivStunden).toBe(200);
    expect(v.maxAntraege).toBe(11); // floor(200 / (9*2))
    expect(v.restStunden).toBe(200);
    expect(v.restAntraege).toBe(11);
    expect(v.zugewiesenAnzahl).toBe(0);
    expect(v.ueberbuchung).toBe(0);
  });

  it('25% Abschlag → effektivStunden auf 75% der Quartals-Kap', () => {
    const ma = makeMa({ abschlagProzent: 25 });
    const v = computeKapazitaet(ma, [], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.effektivStunden).toBe(150);
    expect(v.maxAntraege).toBe(8); // floor(150 / 18)
  });

  it('verbrauchteStunden + zugewiesenAnzahl summieren freigegeben+selbst', () => {
    const ma = makeMa();
    const zw = [
      makeZuweisung({ antragId: 'A', stunden: 18, status: 'freigegeben' }),
      makeZuweisung({ antragId: 'B', stunden: 27, status: 'selbst' }),
      makeZuweisung({ antragId: 'C', stunden: 9, status: 'vorgeschlagen' }),  // wird NICHT gezaehlt
      makeZuweisung({ antragId: 'D', stunden: 18, status: 'abgelehnt' }),     // wird NICHT gezaehlt
    ];
    const v = computeKapazitaet(ma, zw, DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.verbrauchteStunden).toBe(45);
    expect(v.zugewiesenAnzahl).toBe(2);
  });

  it('Ueberbuchung: restStunden < 0 setzt ueberbuchung > 0', () => {
    const ma = makeMa({ jahresKapazitaet: 200 }); // → 50 h/Q
    const zw = [makeZuweisung({ stunden: 80 })];   // verbraucht > rest
    const v = computeKapazitaet(ma, zw, DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.restStunden).toBe(-30);
    expect(v.ueberbuchung).toBe(30);
    expect(v.restAntraege).toBe(-2); // floor(-30/18) = -2
  });

  it('restAntraege wird aus restStunden gerechnet (NICHT max-zugewiesen)', () => {
    // MA mit 200h frei, hat aber einen 4-TV-Verbund (36h * 4 = nicht modelliert
    // hier — Zuweisungs-Stunden zaehlen). Wir simulieren: 4 Zuweisungen mit
    // unterschiedlich vielen Stunden.
    const ma = makeMa();
    const zw = [
      makeZuweisung({ antragId: 'A', stunden: 36 }), // 4-TV-Verbund
      makeZuweisung({ antragId: 'B', stunden: 18 }), // 2-TV-Verbund
    ];
    const v = computeKapazitaet(ma, zw, DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.verbrauchteStunden).toBe(54);
    expect(v.restStunden).toBe(146);
    expect(v.zugewiesenAnzahl).toBe(2);
    // Klassische Formel: maxAntraege - zugewiesen = 11 - 2 = 9
    // Aber unsere Formel: floor(146/18) = 8 — korrekt, weil A 2x so viel
    // verbraucht hat wie ein durchschnittlicher Antrag.
    expect(v.restAntraege).toBe(8);
  });

  it('quartal-Mismatch: Zuweisungen aus anderem Quartal ignoriert', () => {
    const ma = makeMa();
    const zw = [
      makeZuweisung({ quartal: '2026-Q1', stunden: 100 }),
      makeZuweisung({ quartal: '2026-Q2', stunden: 18 }),
    ];
    const v = computeKapazitaet(ma, zw, DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.verbrauchteStunden).toBe(18);
  });

  it('Abschlag 100% → effektivStunden = 0, alle Antraege ueberbucht', () => {
    const ma = makeMa({ abschlagProzent: 100 });
    const v = computeKapazitaet(ma, [makeZuweisung()], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
    expect(v.effektivStunden).toBe(0);
    expect(v.restStunden).toBe(-18);
    expect(v.ueberbuchung).toBe(18);
  });

  describe('externeAnzahl (Master-CSV-Zuweisungen)', () => {
    it('externeAnzahl=0 (default) → identisch zum bisherigen Verhalten', () => {
      const ma = makeMa();
      const a = computeKapazitaet(ma, [], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2');
      const b = computeKapazitaet(ma, [], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2', 0);
      expect(a.restStunden).toBe(b.restStunden);
      expect(a.restAntraege).toBe(b.restAntraege);
      expect(a.zugewiesenAnzahl).toBe(b.zugewiesenAnzahl);
      expect(a.externeAnzahl).toBe(0);
      expect(b.externeAnzahl).toBe(0);
    });

    it('externeAnzahl=3 → reduziert restAntraege + erhöht zugewiesenAnzahl', () => {
      const ma = makeMa();  // 800 h/Jahr → 200 h/Q → maxAntraege=11
      const v = computeKapazitaet(ma, [], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2', 3);
      // 3 externe × 18h = 54h verbraucht
      expect(v.verbrauchteStunden).toBe(54);
      expect(v.zugewiesenAnzahl).toBe(3);
      expect(v.externeAnzahl).toBe(3);
      expect(v.restStunden).toBe(146);
      expect(v.restAntraege).toBe(8); // floor(146/18)
    });

    it('externeAnzahl + Store-Zuweisungen kombinieren sich additiv', () => {
      const ma = makeMa();
      const zw = [makeZuweisung({ antragId: 'A', stunden: 18, status: 'selbst' })];
      const v = computeKapazitaet(ma, zw, DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2', 2);
      // Store: 18h + Extern: 2*18 = 36h → 54h gesamt
      expect(v.verbrauchteStunden).toBe(54);
      expect(v.zugewiesenAnzahl).toBe(3);
      expect(v.externeAnzahl).toBe(2);
    });

    it('externeAnzahl=-1 → wird auf 0 geklemmt (kein negativer Verbrauch)', () => {
      const ma = makeMa();
      const v = computeKapazitaet(ma, [], DEFAULT_AUSLASTUNG_CONFIG, '2026-Q2', -1);
      expect(v.verbrauchteStunden).toBe(0);
      expect(v.zugewiesenAnzahl).toBe(0);
      expect(v.externeAnzahl).toBe(0);
    });
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

  it('ratio < 0 (ueberbucht) → min 0.05, nicht 0', () => {
    expect(kapazitaetsScore(-1000, 18, 50)).toBeGreaterThanOrEqual(0.05);
    expect(kapazitaetsScore(-9, 18, 50)).toBeGreaterThan(0);
  });

  it('Quartals-Ende-Bonus bei < bonusTage Tagen', () => {
    const ohneBonus = kapazitaetsScore(0, 18, 50, 21);     // 50 > 21 → kein Bonus
    const mitBonus = kapazitaetsScore(0, 18, 10, 21);      // 10 < 21 → Bonus
    expect(mitBonus).toBeGreaterThan(ohneBonus);
    // Bonus = (21-10)/21 * 0.15 ≈ 0.0786
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
  it('Q2 2026, heute Mitte April → 75-80 Tage bis Q-Ende', () => {
    const now = new Date(2026, 3, 15, 12, 0, 0);  // 15. April 2026 (lokal)
    const days = tageImQuartal('2026-Q2', now);
    expect(days).toBeGreaterThanOrEqual(75);
    expect(days).toBeLessThanOrEqual(80);
  });

  it('heute = Quartals-Ende → 0 oder 1', () => {
    const now = new Date(2026, 5, 30, 23, 50, 0); // 30. Juni 2026, 23:50
    const days = tageImQuartal('2026-Q2', now);
    expect(days).toBeLessThanOrEqual(1);
  });

  it('Quartal in der Vergangenheit → 0', () => {
    const now = new Date(2026, 5, 15);  // 15. Juni 2026
    expect(tageImQuartal('2026-Q1', now)).toBe(0);
  });

  it('Quartals-Format ungueltig → 0', () => {
    expect(tageImQuartal('foo')).toBe(0);
    expect(tageImQuartal('2026-Q5')).toBe(0);
    expect(tageImQuartal('')).toBe(0);
  });
});
