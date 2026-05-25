import { describe, it, expect } from 'vitest';
import {
  runMatching,
  computeAlpha,
  computeVerbrauchByAnon,
} from '../services/matching-engine';
import { buildAnonymMapForTests } from './test-helpers';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymerMitarbeiter, AuslastungConfig, Zuweisung } from '../types';
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
  ueberKategorien: string[],
  kap = 1600,
  tech: string[] = [],
  aktiv = true,
): AnonymerMitarbeiter {
  return {
    anonId,
    jahresKapazitaet: kap,
    abgemeldet: [],
    manuelleTechnologien: tech,
    ausgeblendeteAutoTags: [],
    ueberKategorien,
    virtuelleProjekte: [],
    onboardingAbgeschlossen: true,
    aktiv,
  };
}

function makeConfig(overrides: Partial<AuslastungConfig> = {}): AuslastungConfig {
  return { ...DEFAULT_AUSLASTUNG_CONFIG, ...overrides };
}

describe('computeAlpha', () => {
  it('mindestens ein high (>0.5) -> 1.0', () => {
    expect(computeAlpha([
      { anonId: 'MA01', score: 0.8, matchendeTechnologien: [], confidence: 'high' },
      { anonId: 'MA02', score: 0.1, matchendeTechnologien: [], confidence: 'low' },
    ])).toBe(1.0);
  });
  it('mindestens ein medium -> 0.5', () => {
    expect(computeAlpha([
      { anonId: 'MA01', score: 0.3, matchendeTechnologien: [], confidence: 'medium' },
    ])).toBe(0.5);
  });
  it('alle low -> 0.2', () => {
    expect(computeAlpha([
      { anonId: 'MA01', score: 0.1, matchendeTechnologien: [], confidence: 'low' },
    ])).toBe(0.2);
  });
  it('leer -> 0.2', () => {
    expect(computeAlpha([])).toBe(0.2);
  });
});

describe('computeVerbrauchByAnon', () => {
  it('summiert freigegebene + selbst-eingetragene Stunden im Quartal', () => {
    const z: Zuweisung[] = [
      { antragId: 'A1', anonId: 'MA01', quartal: '2026-Q2', stunden: 10, status: 'freigegeben' },
      { antragId: 'A2', anonId: 'MA01', quartal: '2026-Q2', stunden: 20, status: 'selbst' },
      { antragId: 'A3', anonId: 'MA01', quartal: '2026-Q1', stunden: 30, status: 'freigegeben' }, // anderes Quartal
      { antragId: 'A4', anonId: 'MA01', quartal: '2026-Q2', stunden: 40, status: 'abgelehnt' },   // abgelehnt
      { antragId: 'A5', anonId: 'MA02', quartal: '2026-Q2', stunden: 5, status: 'freigegeben' },
    ];
    const map = computeVerbrauchByAnon(z, '2026-Q2');
    expect(map.get('MA01')).toBe(30);
    expect(map.get('MA02')).toBe(5);
  });
});

describe('runMatching', () => {
  it('matched nur MAs aus der gleichen Ueberkategorie (no leak)', () => {
    const m1 = makeMa('MA01', ['IKT'], 1600, ['KI']);
    const m2 = makeMa('MA02', ['IND'], 1600, ['KI']);  // gleiches Tech-Wissen aber falsche Kat.
    const antrag = makeAntrag('A1', { verbund_titel: 'KI-Projekt' } as Partial<Antrag>);
    const res = runMatching({
      antrag,
      kategorieIds: ['IKT'],
      config: makeConfig(),
      mitarbeiter: { MA01: m1, MA02: m2 },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(res.every(r => r.anonId === 'MA01')).toBe(true);
  });

  it('1.17: MA mit knapper Kapazitaet bleibt im Ranking (weiches Modell)', () => {
    const m1 = makeMa('MA01', ['IKT'], 400, ['KI']);  // 400h/Jahr -> 100h/Q
    const m2 = makeMa('MA02', ['IKT'], 1600, ['KI']);
    const zuweisungen: Zuweisung[] = [
      { antragId: 'X', anonId: 'MA01', quartal: '2026-Q2', stunden: 95, status: 'freigegeben' },
    ];
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
      kategorieIds: ['IKT'],
      config: makeConfig({ aktuellesQuartal: '2026-Q2', stundenProTV: 10 }),
      mitarbeiter: { MA01: m1, MA02: m2 },
      zuweisungen,
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    // 1.17: MA01 bleibt sichtbar (kein harter Filter mehr), nur niedrigerer
    // KapScore. MA02 mit viel Kapazitaet sollte trotzdem oben sein.
    expect(res.some(r => r.anonId === 'MA01')).toBe(true);
    expect(res.some(r => r.anonId === 'MA02')).toBe(true);
    const ma1 = res.find(r => r.anonId === 'MA01')!;
    const ma2 = res.find(r => r.anonId === 'MA02')!;
    // MA02 hat mehr Kapazitaet → hoeherer finalScore
    expect(ma2.finalScore).toBeGreaterThan(ma1.finalScore);
    // Beide haben kapazitaetsScore gesetzt
    expect(ma1.kapazitaetsScore).toBeGreaterThanOrEqual(0);
    expect(ma2.kapazitaetsScore).toBeGreaterThan(ma1.kapazitaetsScore!);
  });

  it('Quartal abgemeldet -> MA raus', () => {
    const m1 = makeMa('MA01', ['IKT']);
    m1.abgemeldet = ['2026-Q2'];
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
      kategorieIds: ['IKT'],
      config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
      mitarbeiter: { MA01: m1 },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(res).toEqual([]);
  });

  it('Top-3-Sortierung nach finalScore desc', () => {
    const m1 = makeMa('MA01', ['IKT'], 1600, ['KI']);
    const m2 = makeMa('MA02', ['IKT'], 1600, ['KI', 'machine learning']);
    const m3 = makeMa('MA03', ['IKT'], 1600, ['sensorik']);  // matched nichts
    const m4 = makeMa('MA04', ['IKT'], 1600, []);
    const antrag = makeAntrag('A1', {
      verbund_titel: 'Machine Learning fuer Bilderkennung',
      titel: 'KI-Detektor',
    } as Partial<Antrag>);
    const res = runMatching({
      antrag,
      kategorieIds: ['IKT'],
      config: makeConfig(),
      mitarbeiter: { MA01: m1, MA02: m2, MA03: m3, MA04: m4 },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
      topN: 3,
    });
    expect(res.length).toBeLessThanOrEqual(3);
    // Sortierung: finalScore monoton fallend
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1]!.finalScore).toBeGreaterThanOrEqual(res[i]!.finalScore);
    }
  });

  it('keine Kategorien -> leeres Ergebnis', () => {
    const res = runMatching({
      antrag: makeAntrag('A1'),
      kategorieIds: [],
      config: makeConfig(),
      mitarbeiter: { MA01: makeMa('MA01', ['IKT']) },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(res).toEqual([]);
  });

  it('MA ohne Onboarding UND ohne hist. Antraege wird uebersprungen', () => {
    const m1 = makeMa('MA01', ['IKT'], 1600, ['KI']);
    m1.onboardingAbgeschlossen = false;
    const res = runMatching({
      antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
      kategorieIds: ['IKT'],
      config: makeConfig(),
      mitarbeiter: { MA01: m1 },
      zuweisungen: [],
      historischeDeskriptorenByAnon: new Map(),  // keine Profile -> kein Match
      anonymMap: buildAnonymMapForTests([]),
    });
    expect(res).toEqual([]);
  });

  describe('1.17: Primaer+Aspekte + Aspekt-Bonus', () => {
    it('Pool: MA hauptKategorie=IT, antrag.primaer=DT → MA nicht eligible', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', [], 1600, ['KI']),
        hauptKategorie: 'IT',
        nebenKategorien: [],
      };
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
        primaerKategorie: 'DT',
        aspekte: [],
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map(),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toEqual([]);
    });

    it('Pool: hauptKategorie matched → eligible', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        nebenKategorien: [],
      };
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
        primaerKategorie: 'IT',
        aspekte: [],
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map(),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toHaveLength(1);
      expect(res[0]!.anonId).toBe('MA01');
    });

    it('Aspekt-Bonus: MA-Nebenkategorie matched Antrag-Aspekt → Bonus aktiv', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT', 'DT'], 1600, []),
        hauptKategorie: 'IT',
        nebenKategorien: ['DT'],
      };
      const m2: AnonymerMitarbeiter = {
        ...makeMa('MA02', ['IT'], 1600, []),
        hauptKategorie: 'IT',
        nebenKategorien: [],
      };
      // Schwacher Match-Kontext: keine Tech-Match → niedriger Kompetenz,
      // Bonus sichtbar im Output (sonst Clamp auf 1.0).
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'irrelevantes Thema' } as Partial<Antrag>),
        primaerKategorie: 'IT',
        aspekte: ['DT'],
        config: makeConfig({ aspektBonus: 0.10 }),
        mitarbeiter: { MA01: m1, MA02: m2 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map(),
        anonymMap: buildAnonymMapForTests([]),
      });
      const r1 = res.find(r => r.anonId === 'MA01')!;
      const r2 = res.find(r => r.anonId === 'MA02')!;
      expect(r1.aspektMatchIds).toEqual(['DT']);
      expect(r1.aspektBonus).toBeCloseTo(0.10, 5);
      expect(r2.aspektMatchIds).toEqual([]);
      expect(r2.aspektBonus).toBe(0);
      // MA01 hat Aspekt-Bonus → hoeherer Kompetenz-Score
      expect(r1.kompetenzScore).toBeGreaterThan(r2.kompetenzScore);
    });

    it('Fallback: kategorieIds-Form weiter unterstuetzt (Backwards-Kompat)', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT', 'DT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        nebenKategorien: ['DT'],
      };
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
        kategorieIds: ['IT', 'DT'],  // legacy form
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toHaveLength(1);
      // Aspekt-Bonus auch im legacy-Pfad sichtbar
      expect(res[0]!.aspektMatchIds).toEqual(['DT']);
    });

    it('Fallback: nicht-migrierter MA ohne hauptKategorie nutzt ueberKategorien', () => {
      // Realer Pre-Migration-Zustand: hauptKategorie undefined, ueberKategorien gesetzt
      const m1: AnonymerMitarbeiter = makeMa('MA01', ['IT'], 1600, ['KI']);
      delete (m1 as Partial<AnonymerMitarbeiter>).hauptKategorie;
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
        primaerKategorie: 'IT',
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toHaveLength(1);
    });

    it('Ueberbuchung wird im Output ausgewiesen', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 200, ['KI']),  // 200h/Jahr → 50h/Q
        hauptKategorie: 'IT',
        nebenKategorien: [],
      };
      const zw: Zuweisung[] = [
        { antragId: 'X', anonId: 'MA01', quartal: '2026-Q2', stunden: 80, status: 'freigegeben' },
      ];
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
        primaerKategorie: 'IT',
        config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
        mitarbeiter: { MA01: m1 },
        zuweisungen: zw,
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toHaveLength(1);
      expect(res[0]!.ueberbuchung).toBeGreaterThan(0);
      expect(res[0]!.restKapazitaet).toBeLessThan(0);
    });

    it('Abschlag wird beruecksichtigt', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 800, ['KI']),  // 800h/Jahr → 200h/Q
        hauptKategorie: 'IT',
        nebenKategorien: [],
        abschlagProzent: 50,
      };
      const res = runMatching({
        antrag: makeAntrag('A1', { verbund_titel: 'KI' } as Partial<Antrag>),
        primaerKategorie: 'IT',
        config: makeConfig({ aktuellesQuartal: '2026-Q2' }),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      // 200h × 50% = 100h
      expect(res[0]!.quartalsKapazitaet).toBe(100);
    });
  });
});
