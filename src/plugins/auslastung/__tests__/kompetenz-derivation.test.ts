import { describe, it, expect } from 'vitest';
import {
  deriveHauptNeben,
  kompetenzTokens,
  normLevelForUeber,
  normalizeKompetenzMatrix,
  normalizeKontingent,
  ueberScore,
} from '../services/kompetenz-derivation';
import type { KompetenzMatrix } from '../types';

const AAT: KompetenzMatrix = {
  IT: { 'Werkstofftech.': 1, Fahrzeug: 3 },   // Σ = 4
  DT: { Robotik: 2, SWE: 3 },                  // Σ = 5
  LG: { Lebensmittel: 3 },                     // Σ = 3
  EU: { Energie: 2, Effizienz: 3, Umwelt: 3, Mobil: 3 }, // Σ = 11
};

describe('ueberScore', () => {
  it('summiert Levels einer Ueberkategorie', () => {
    expect(ueberScore(AAT, 'IT')).toBe(4);
    expect(ueberScore(AAT, 'EU')).toBe(11);
    expect(ueberScore(AAT, 'NM')).toBe(0);
    expect(ueberScore(undefined, 'IT')).toBe(0);
  });
});

describe('deriveHauptNeben', () => {
  it('staerkste Ueberkategorie wird Haupt, uebrige >= Schwelle werden Neben', () => {
    const { hauptKategorie, nebenKategorien } = deriveHauptNeben(AAT);
    expect(hauptKategorie).toBe('EU');            // Σ=11 maximal
    expect(nebenKategorien).toEqual(['DT', 'IT', 'LG']); // 5, 4, 3 — alle >= 2, sortiert desc
  });

  it('Neben-Schwelle: Ueberkategorie mit Σ < 2 faellt raus', () => {
    const m: KompetenzMatrix = { IT: { a: 3 }, DT: { b: 1 } }; // DT Σ=1 < 2
    const { hauptKategorie, nebenKategorien } = deriveHauptNeben(m);
    expect(hauptKategorie).toBe('IT');
    expect(nebenKategorien).toEqual([]);
  });

  it('Tie-Break: gleiche Punktzahl → mehr Level-3 gewinnt', () => {
    const m: KompetenzMatrix = { IT: { a: 3 }, DT: { b: 2, c: 1 } }; // beide Σ=3
    expect(deriveHauptNeben(m).hauptKategorie).toBe('IT');           // IT hat ein 3er
  });

  it('leere Matrix → leere Ableitung', () => {
    expect(deriveHauptNeben(undefined)).toEqual({ hauptKategorie: '', nebenKategorien: [] });
    expect(deriveHauptNeben({})).toEqual({ hauptKategorie: '', nebenKategorien: [] });
  });
});

describe('normLevelForUeber', () => {
  it('max-Level / 3', () => {
    expect(normLevelForUeber(AAT, 'EU')).toBeCloseTo(1, 5);   // max 3
    expect(normLevelForUeber(AAT, 'IT')).toBeCloseTo(1, 5);   // max 3 (Fahrzeug)
    expect(normLevelForUeber({ IT: { a: 1 } }, 'IT')).toBeCloseTo(1 / 3, 5);
  });
  it('Ueberkategorie ohne Matrix → 1.0 (neutral)', () => {
    expect(normLevelForUeber(undefined, 'IT')).toBe(1);
    expect(normLevelForUeber(AAT, 'NM')).toBe(1);
  });
});

describe('kompetenzTokens', () => {
  it('jedes Label level-fach (Level 3 = 3x)', () => {
    const toks = kompetenzTokens({ IT: { Leichtbau: 1, Robotik: 3 } });
    expect(toks.filter(t => t === 'Leichtbau')).toHaveLength(1);
    expect(toks.filter(t => t === 'Robotik')).toHaveLength(3);
  });
  it('leere Matrix → []', () => {
    expect(kompetenzTokens(undefined)).toEqual([]);
  });
});

describe('normalizeKompetenzMatrix', () => {
  it('behaelt nur bekannte Ueberkat + gueltige Level', () => {
    const m = normalizeKompetenzMatrix({
      IT: { a: 2, b: 5, c: '3' },  // b ungueltig, c als String
      XX: { z: 1 },                // unbekannte Ueberkat
    });
    expect(m).toEqual({ IT: { a: 2, c: 3 } });
  });
  it('leeres Resultat → undefined', () => {
    expect(normalizeKompetenzMatrix({ IT: { a: 0 } })).toBeUndefined();
    expect(normalizeKompetenzMatrix(null)).toBeUndefined();
  });
});

describe('normalizeKontingent', () => {
  it('nur positive Zahlen je Bucket', () => {
    expect(normalizeKontingent({ FuE: 337, DS: '100', NW: 0, DL: -5 })).toEqual({ FuE: 337, DS: 100 });
  });
  it('leeres Resultat → undefined', () => {
    expect(normalizeKontingent({ NW: 0 })).toBeUndefined();
    expect(normalizeKontingent(undefined)).toBeUndefined();
  });
});
