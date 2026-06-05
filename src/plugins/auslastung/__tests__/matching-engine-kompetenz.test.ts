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

  it('MA ohne Matrix: nur Historie zählt (kein Tabellen-Anteil)', () => {
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

describe('v2.31: Tabelle gleich gewichtet wie Historie (50/50-Blend, boostet wenig-Historie-MAs)', () => {
  const baseInput = (mitarbeiter: Record<string, AnonymerMitarbeiter>, titel: string) => ({
    antrag: makeAntrag('A1', { verbund_titel: titel } as Partial<Antrag>),
    primaerKategorie: 'IT',
    config: makeConfig(),
    mitarbeiter,
    zuweisungen: [] as Zuweisung[],
    historischeDeskriptorenByAnon: new Map<string, string[]>(),
    anonymMap: buildAnonymMapForTests([]),
  });

  it('Tabellen-Kompetenz boostet einen MA ohne passende Historie (Kern-Anforderung)', () => {
    // Antrag-Thema matcht KEINEN Profil-Token → Historie ≈ 0. Der MA mit Matrix
    // hat in der Primaerkategorie Level 3 (matrixScore 1.0) → der 50/50-Blend hebt
    // ihn auf ~0.5; der MA ohne Matrix bleibt bei ~0 (nur Historie).
    const mitMatrix = makeMa('MA01', 'IT', { kompetenzMatrix: { IT: { Robotik: 3 } } });
    const ohneMatrix = makeMa('MA02', 'IT', {});
    const res = runMatching(baseInput({ MA01: mitMatrix, MA02: ohneMatrix }, 'Voellig anderes Thema'));
    const m1 = res.find(r => r.anonId === 'MA01')!;
    const m2 = res.find(r => r.anonId === 'MA02')!;
    expect(m1.kompetenzScore).toBeGreaterThan(m2.kompetenzScore);
    expect(m1.kompetenzScore).toBeCloseTo(0.5, 5); // 0.5·Historie(0) + 0.5·Tabelle(1.0)
    expect(m2.kompetenzScore).toBeCloseTo(0, 5);
  });

  it('Level graduiert den Boost: Experte (3) über Anfaenger (1) auch ganz ohne Historie', () => {
    const expert = makeMa('MA01', 'IT', { kompetenzMatrix: { IT: { Robotik: 3 } } });
    const anfaenger = makeMa('MA02', 'IT', { kompetenzMatrix: { IT: { Robotik: 1 } } });
    const res = runMatching(baseInput({ MA01: expert, MA02: anfaenger }, 'Voellig anderes Thema'));
    const e = res.find(r => r.anonId === 'MA01')!;
    const a = res.find(r => r.anonId === 'MA02')!;
    expect(e.kompetenzScore).toBeCloseTo(0.5, 5);       // 0.5·1.0
    expect(a.kompetenzScore).toBeCloseTo(0.5 / 3, 5);   // 0.5·0.333
    expect(e.kompetenzScore).toBeGreaterThan(a.kompetenzScore);
  });

  it('MA ohne Matrix: reiner Historie-Score, kein Tabellen-Anteil', () => {
    // Passende Tech/Historie → BM25 matcht → Score > 0; fehlende Tabelle
    // (matrixScore undefined) veraendert den Score nicht.
    const ohne = makeMa('MA01', 'IT', { manuelleTechnologien: ['Robotik'] });
    const res = runMatching(baseInput({ MA01: ohne }, 'Robotik Vorhaben'));
    expect(res[0]!.kompetenzScore).toBeGreaterThan(0);
  });
});

describe('v2.15: Antragstyp-Kontingent', () => {
  it('MA mit erschöpftem FuE-Kontingent rutscht ab', () => {
    // MA01 hat ein FuE-Kontingent von 36 Std./Jahr (= 9 h/Quartal = 1 TV bei
    // stundenProTV 9) das durch 1 TV bereits aufgebraucht ist. MA02 hat keine
    // FuE-Stunden (kein FuE-Limit), aber DS-Kapazität → bleibt matchbar.
    const gedeckelt = makeMa('MA01', 'IT', { manuelleTechnologien: ['KI'], jahresKapazitaetProTyp: { FuE: 36 } });
    const offen = makeMa('MA02', 'IT', { manuelleTechnologien: ['KI'], jahresKapazitaetProTyp: { DS: 800 } });
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
    // FuE 36 Std./Jahr → 1 TV/Quartal (stundenProTV 9); 1 fest gebuchter FuE-TV → erschöpft.
    const gedeckelt = makeMa('MA01', 'IT', { manuelleTechnologien: ['KI'], jahresKapazitaetProTyp: { FuE: 36 } });
    const offen = makeMa('MA02', 'IT', { manuelleTechnologien: ['KI'], jahresKapazitaetProTyp: { DS: 800 } });
    const bucket = (proTyp: Record<string, number>) => ({
      antraege: 0, tvs: 0, stunden: 0, aktenzeichenSet: new Set<string>(), verbuende: [],
      antraegeProTyp: proTyp, tvsProTyp: proTyp,
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

describe('Multiplikativer Kapazitäts-Malus (ausgelastete MAs deutlich abwerten)', () => {
  // Synthetischer Bucket: nur `stunden` befüllt (erschöpft die Stunden-Kapazität),
  // tvsProTyp leer (kein Kontingent-Effekt) → isoliert den kapMultiplier.
  const bucket = (stunden: number) => ({
    antraege: 0, tvs: 0, stunden, aktenzeichenSet: new Set<string>(), verbuende: [],
    antraegeProTyp: {}, tvsProTyp: {},
  });
  type Ausl = Parameters<typeof runMatching>[0]['auslastungByAnon'];

  const runSingle = (auslastungMalus: number, festStunden: number) => {
    const ma = makeMa('MA01', 'IT', {
      manuelleTechnologien: ['Robotik'],
      jahresKapazitaetProTyp: { FuE: 360 }, // 90h/Quartal
    });
    const auslastungByAnon = new Map([
      ['MA01', { fest: bucket(festStunden), pending: bucket(0) }],
    ]) as unknown as Ausl;
    return runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'Robotik Vorhaben', vb_phase: 3 } as unknown as Partial<Antrag>),
      primaerKategorie: 'IT',
      config: makeConfig({ aktuellesQuartal: '2026-Q2', auslastungMalus }),
      mitarbeiter: { MA01: ma },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
      auslastungByAnon,
      tageImQuartal: 90, // deterministisch: kein Quartalsende-Bonus
    })[0]!;
  };

  it('ausgelasteter MA: finalScore mit Malus deutlich < ohne Malus', () => {
    const mit = runSingle(0.6, 90);  // 90h gebucht = voll
    const ohne = runSingle(0, 90);
    expect(mit.finalScore).toBeLessThan(ohne.finalScore);
  });

  it('MA mit freier Kapazität: Malus wirkungslos (kapScore≈1 → Faktor 1)', () => {
    const mit = runSingle(0.6, 0);   // nichts gebucht = frei
    const ohne = runSingle(0, 0);
    expect(mit.finalScore).toBeCloseTo(ohne.finalScore, 10);
  });

  it('bei gleicher Kompetenz rankt der MA mit freier Kapazität vor dem ausgelasteten', () => {
    const frei = makeMa('MA01', 'IT', { manuelleTechnologien: ['Robotik'], jahresKapazitaetProTyp: { FuE: 360 } });
    const voll = makeMa('MA02', 'IT', { manuelleTechnologien: ['Robotik'], jahresKapazitaetProTyp: { FuE: 360 } });
    const auslastungByAnon = new Map([
      ['MA02', { fest: bucket(90), pending: bucket(0) }], // MA02 ausgelastet
    ]) as unknown as Ausl;
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'Robotik Vorhaben', vb_phase: 3 } as unknown as Partial<Antrag>),
      primaerKategorie: 'IT',
      config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
      mitarbeiter: { MA01: frei, MA02: voll },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
      auslastungByAnon,
      tageImQuartal: 90,
    });
    expect(res[0]!.anonId).toBe('MA01');
  });
});
