/**
 * Matcher-Integration für die v2.15-Kompetenz-Vorbelegung:
 *  - Level-Gewichtung (Experte rankt vor Anfänger)
 *  - Antragstyp-Kontingent (erschöpftes Kontingent → weicher Malus)
 */
import { describe, it, expect } from 'vitest';
import { runMatching } from '../services/matching-engine';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter, AuslastungConfig, Zuweisung } from '../types';
import { DEFAULT_AUSLASTUNG_CONFIG } from '../types';

function makeAntrag(az: string, fields: Partial<Antrag> = {}): Antrag {
  return { aktenzeichen: az, programm_id: 'p1', _field_sources: {}, _updated_at: '', ...fields } as Antrag;
}

function makeMa(anonId: string, haupt: string, extra: Partial<AnonymerMitarbeiter> = {}): AnonymerMitarbeiter {
  return {
    anonId, jahresKapazitaet: 1600, abgemeldet: [], manuelleTechnologien: [],
    ausgeblendeteAutoTags: [], hauptKategorie: haupt, nebenKategorien: [], abschlagProzent: 0,
    virtuelleProjekte: [], onboardingAbgeschlossen: true, aktiv: true, ...extra,
  };
}

function makeConfig(o: Partial<AuslastungConfig> = {}): AuslastungConfig {
  return { ...DEFAULT_AUSLASTUNG_CONFIG, ...o };
}

describe('v2.15: Kompetenz-Level-Gewichtung', () => {
  it('Experte (Level 3) rankt vor Anfänger (Level 1) bei gleichem Thema', () => {
    const expert = makeMa('MA01', 'IT', { kompetenzMatrix: { IT: { Robotik: 3 } } });
    const anfaenger = makeMa('MA02', 'IT', { kompetenzMatrix: { IT: { Robotik: 1 } } });
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'Robotik Vorhaben' } as Partial<Antrag>),
      primaerKategorie: 'IT',
      config: makeConfig(),
      mitarbeiter: { MA01: expert, MA02: anfaenger },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    const e = res.find(r => r.anonId === 'MA01')!;
    const a = res.find(r => r.anonId === 'MA02')!;
    expect(e.kompetenzScore).toBeGreaterThan(a.kompetenzScore);
    expect(e.finalScore).toBeGreaterThan(a.finalScore);
  });

  it('MA ohne Matrix bleibt unverändert (Faktor 1.0 = altes Verhalten)', () => {
    const ohne = makeMa('MA01', 'IT', { manuelleTechnologien: ['Robotik'] });
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'Robotik' } as Partial<Antrag>),
      primaerKategorie: 'IT',
      config: makeConfig(),
      mitarbeiter: { MA01: ohne },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(res).toHaveLength(1);
    expect(res[0]!.kompetenzScore).toBeGreaterThan(0);
  });
});

describe('v2.15: Antragstyp-Kontingent', () => {
  it('MA mit erschöpftem FuE-Kontingent rutscht ab', () => {
    // Beide verbrauchen gleich viel Kapazität (je 1 Antrag), aber MA01 hat ein
    // FuE-Kontingent von 4/Jahr (= 1/Quartal) das bereits aufgebraucht ist.
    const gedeckelt = makeMa('MA01', 'IT', { manuelleTechnologien: ['KI'], jahresKapazitaetProTyp: { FuE: 4 } });
    const offen = makeMa('MA02', 'IT', { manuelleTechnologien: ['KI'] });
    const zuweisungen: Zuweisung[] = [
      { antragId: 'X', anonId: 'MA01', quartal: '2026-Q2', stunden: 9, status: 'freigegeben' }, // FuE
      { antragId: 'Y', anonId: 'MA02', quartal: '2026-Q2', stunden: 9, status: 'freigegeben' }, // DS
    ];
    const antraegeIndex = new Map<string, { aktenzeichen: string; vb_phase?: unknown }>([
      ['X', { aktenzeichen: 'X', vb_phase: 3 }], // FuE
      ['Y', { aktenzeichen: 'Y', vb_phase: 5 }], // DS
    ]);
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'KI', vb_phase: 3 } as unknown as Partial<Antrag>), // FuE
      primaerKategorie: 'IT',
      config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
      mitarbeiter: { MA01: gedeckelt, MA02: offen },
      zuweisungen,
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
      antraegeIndex,
    });
    const m1 = res.find(r => r.anonId === 'MA01')!;
    const m2 = res.find(r => r.anonId === 'MA02')!;
    expect(m1.kontingentScore).toBe(0.5);
    expect(m1.kontingentRest).toBe(0);
    expect(m2.kontingentScore).toBe(1);
    expect(m2.kontingentRest).toBeUndefined();
    expect(m2.finalScore).toBeGreaterThan(m1.finalScore);
  });

  it('v2.16: Kontingent-Malus greift aus fest gebuchten CSV-Anträgen (auslastungByAnon)', () => {
    const gedeckelt = makeMa('MA01', 'IT', { manuelleTechnologien: ['KI'], jahresKapazitaetProTyp: { FuE: 4 } }); // Q=1
    const offen = makeMa('MA02', 'IT', { manuelleTechnologien: ['KI'] });
    const bucket = (proTyp: Record<string, number>) => ({
      antraege: 0, tvs: 0, stunden: 0, aktenzeichenSet: new Set<string>(), verbuende: [], antraegeProTyp: proTyp,
    });
    // MA01 hat 1 FuE-Antrag fest in der CSV (keine Store-Zuweisung!) → Kontingent erschöpft.
    const auslastungByAnon = new Map([
      ['MA01', { fest: bucket({ FuE: 1 }), pending: bucket({}) }],
    ]) as unknown as Parameters<typeof runMatching>[0]['auslastungByAnon'];
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'KI', vb_phase: 3 } as unknown as Partial<Antrag>),
      primaerKategorie: 'IT',
      config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
      mitarbeiter: { MA01: gedeckelt, MA02: offen },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
      auslastungByAnon,
    });
    const m1 = res.find(r => r.anonId === 'MA01')!;
    const m2 = res.find(r => r.anonId === 'MA02')!;
    expect(m1.kontingentScore).toBe(0.5);
    expect(m1.kontingentRest).toBe(0);
    expect(m1.kontingentQuartal).toBe(1);
    expect(m2.kontingentScore).toBe(1);
    expect(m2.finalScore).toBeGreaterThan(m1.finalScore);
  });
});
