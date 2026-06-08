/**
 * Tests für `runMatchingWithContext` (v2.48) — Nebenkompetenz-Pool,
 * Ausschluss-Gründe und Score-Breakdown. Die Haupt-Vorschläge-Parität zur
 * Pre-v2.48-Engine ist über `runMatching` (Wrapper) in matching-engine.test.ts
 * abgedeckt; hier zusätzlich ein expliziter Parität-Check.
 */
import { describe, it, expect } from 'vitest';
import { runMatching, runMatchingWithContext } from '../services/matching-engine';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter, AuslastungConfig, KompetenzMatrix } from '../types';
import { DEFAULT_AUSLASTUNG_CONFIG } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    _field_sources: {},
    _updated_at: new Date().toISOString(),
    ...fields,
  } as Antrag;
}

function makeMa(
  anonId: string,
  hauptKategorie: string,
  nebenKategorien: string[] = [],
  extra: Partial<AnonymerMitarbeiter> = {},
): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: 1600,
    jahresKapazitaetProTyp: { FuE: 1600 },
    abgemeldet: [],
    manuelleTechnologien: [],
    ausgeblendeteAutoTags: [],
    hauptKategorie,
    nebenKategorien,
    abschlagProzent: 0,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv: true,
    ...extra,
  };
}

function makeConfig(overrides: Partial<AuslastungConfig> = {}): AuslastungConfig {
  return { ...DEFAULT_AUSLASTUNG_CONFIG, ...overrides };
}

function baseInput(mitarbeiter: Record<string, AnonymerMitarbeiter>, primaer = 'DT') {
  return {
    antrag: makeAntrag('A1', { verbund_titel: 'KI-Projekt' } as Partial<Antrag>),
    primaerKategorie: primaer,
    aspekte: [] as string[],
    config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
    mitarbeiter,
    zuweisungen: [],
    historischeDeskriptorenByAnon: new Map<string, string[]>(),
    anonymMap: buildAnonymMapForTests([]),
  };
}

describe('runMatchingWithContext — Nebenkompetenz-Pool', () => {
  it('MA mit primaer NUR als Nebenkategorie → nebenkompetenz, nicht vorschlaege', () => {
    const ma = makeMa('MA01', 'IT', ['DT']); // DT ist Nebenkompetenz
    const ctx = runMatchingWithContext(baseInput({ MA01: ma }, 'DT'));
    expect(ctx.vorschlaege).toHaveLength(0);
    expect(ctx.nebenkompetenz.map(m => m.anonId)).toEqual(['MA01']);
    expect(ctx.nebenkompetenz[0]!.breakdown?.matchKind).toBe('neben');
    // runMatching (Wrapper) liefert nur die Haupt-Vorschläge → leer.
    expect(runMatching(baseInput({ MA01: ma }, 'DT'))).toHaveLength(0);
  });

  it('Haupt- und Nebenkompetenz werden getrennt einsortiert', () => {
    const haupt = makeMa('MA01', 'DT');           // DT = Hauptkategorie
    const neben = makeMa('MA02', 'IT', ['DT']);   // DT = Nebenkompetenz
    const ctx = runMatchingWithContext(baseInput({ MA01: haupt, MA02: neben }, 'DT'));
    expect(ctx.vorschlaege.map(m => m.anonId)).toEqual(['MA01']);
    expect(ctx.nebenkompetenz.map(m => m.anonId)).toEqual(['MA02']);
    expect(ctx.vorschlaege[0]!.breakdown?.matchKind).toBe('haupt');
  });

  it('MA ohne Bezug zur Primärkategorie taucht nirgends auf', () => {
    const fremd = makeMa('MA01', 'IT', ['EU']);   // weder Haupt noch Neben = DT
    const ctx = runMatchingWithContext(baseInput({ MA01: fremd }, 'DT'));
    expect(ctx.vorschlaege).toHaveLength(0);
    expect(ctx.nebenkompetenz).toHaveLength(0);
    expect(ctx.ausgeschlossen).toHaveLength(0);
  });
});

describe('runMatchingWithContext — Ausschluss-Gründe', () => {
  it('inaktiver kategorie-relevanter MA → grund "inaktiv"', () => {
    const ma = makeMa('MA01', 'DT', [], { aktiv: false });
    const ctx = runMatchingWithContext(baseInput({ MA01: ma }, 'DT'));
    expect(ctx.vorschlaege).toHaveLength(0);
    expect(ctx.ausgeschlossen).toEqual([
      expect.objectContaining({ anonId: 'MA01', grund: 'inaktiv' }),
    ]);
  });

  it('MA ohne Onboarding + ohne Historie → grund "kein-onboarding"', () => {
    const ma = makeMa('MA01', 'DT', [], { onboardingAbgeschlossen: false });
    const ctx = runMatchingWithContext(baseInput({ MA01: ma }, 'DT'));
    expect(ctx.vorschlaege).toHaveLength(0);
    expect(ctx.ausgeschlossen[0]).toMatchObject({ anonId: 'MA01', grund: 'kein-onboarding' });
  });

  it('im Quartal abgemeldeter MA → grund "abgemeldet"', () => {
    const ma = makeMa('MA01', 'DT', [], { abgemeldet: ['2026-Q2'] });
    const ctx = runMatchingWithContext(baseInput({ MA01: ma }, 'DT'));
    expect(ctx.ausgeschlossen[0]).toMatchObject({ anonId: 'MA01', grund: 'abgemeldet' });
  });

  it('Antragstyp-Restriktion → grund "antragstyp"', () => {
    const ma = makeMa('MA01', 'DT', [], { antragstypBevorzugt: ['FuE'] });
    const input = {
      ...baseInput({ MA01: ma }, 'DT'),
      antrag: makeAntrag('A1', { verbund_titel: 'KI', vb_phase: 5 } as unknown as Partial<Antrag>), // DS
      historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
    };
    const ctx = runMatchingWithContext(input);
    expect(ctx.vorschlaege).toHaveLength(0);
    expect(ctx.ausgeschlossen[0]).toMatchObject({ anonId: 'MA01', grund: 'antragstyp' });
  });

  it('über Top-N geschnittene Haupt-MAs → grund "rang" mit kompetenzScore', () => {
    const mitarbeiter: Record<string, AnonymerMitarbeiter> = {};
    for (let i = 1; i <= 6; i++) mitarbeiter[`MA0${i}`] = makeMa(`MA0${i}`, 'DT');
    const ctx = runMatchingWithContext({ ...baseInput(mitarbeiter, 'DT'), topN: 5 });
    expect(ctx.vorschlaege).toHaveLength(5);
    const rang = ctx.ausgeschlossen.filter(a => a.grund === 'rang');
    expect(rang).toHaveLength(1);
    expect(typeof rang[0]!.kompetenzScore).toBe('number');
  });
});

describe('runMatchingWithContext — Score-Breakdown', () => {
  it('ohne Kompetenztabellen-Eintrag ist matrixScore null (nur Historie zählt)', () => {
    const ma = makeMa('MA01', 'DT');
    const ctx = runMatchingWithContext(baseInput({ MA01: ma }, 'DT'));
    const b = ctx.vorschlaege[0]!.breakdown!;
    expect(b.matrixScore).toBeNull();
    expect(typeof b.histScore).toBe('number');
    expect(typeof b.alpha).toBe('number');
  });

  it('mit Kompetenztabellen-Eintrag fließt matrixScore in den Breakdown', () => {
    const matrix: KompetenzMatrix = { DT: { Schwerpunkt: 3 } };
    const ma = makeMa('MA01', 'DT', [], { kompetenzMatrix: matrix });
    const ctx = runMatchingWithContext(baseInput({ MA01: ma }, 'DT'));
    const b = ctx.vorschlaege[0]!.breakdown!;
    expect(b.matrixScore).toBeCloseTo(1.0, 5); // Level 3 / 3
    expect(b.matrixGewicht).toBeGreaterThan(0);
  });
});

describe('runMatchingWithContext — Parität zu runMatching', () => {
  it('runMatching entspricht runMatchingWithContext(...).vorschlaege', () => {
    const mitarbeiter = {
      MA01: makeMa('MA01', 'DT'),
      MA02: makeMa('MA02', 'DT', [], { manuelleTechnologien: ['KI'] }),
      MA03: makeMa('MA03', 'IT', ['DT']),
    };
    const a = runMatching(baseInput(mitarbeiter, 'DT'));
    const b = runMatchingWithContext(baseInput(mitarbeiter, 'DT')).vorschlaege;
    expect(a).toEqual(b);
  });
});
