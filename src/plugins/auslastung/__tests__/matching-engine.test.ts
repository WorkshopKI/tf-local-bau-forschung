import { describe, it, expect } from 'vitest';
import {
  runMatching,
  runMatchingWithContext,
  computeAlpha,
  computeVerbrauchByAnon,
} from '../services/matching';
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
    // Default-Antragstyp FuE (vb_phase=3) — passt zum FuE-Kontingent von
    // `makeMa`, damit der v2.60-Antragstyp-Filter (abgeleitet aus dem Kontingent)
    // diese auf andere Dimensionen fokussierten Fixtures nicht ausschliesst.
    vb_phase: 3,
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
    jahresKapazitaet: kap, // deprecated, wird nicht mehr gelesen
    // Effektive Jahresstunden = Summe der Typ-Stunden; hier komplett auf FuE.
    jahresKapazitaetProTyp: { FuE: kap },
    abgemeldet: [],
    manuelleTechnologien: tech,
    ausgeblendeteAutoTags: [],
    hauptKategorie: ueberKategorien[0] ?? '',
    nebenKategorien: ueberKategorien.slice(1),
    abschlagProzent: 0,
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

  describe('v2.2: Antragstyp-Praeferenz-Filter', () => {
    function makeAntragMit(vbPhase: number): Antrag {
      return makeAntrag('A1', {
        verbund_titel: 'KI',
        vb_phase: vbPhase,
      } as unknown as Partial<Antrag>);
    }

    it('MA mit antragstypBevorzugt=[FuE] bekommt DS-Antrag nicht', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        antragstypBevorzugt: ['FuE'],
      };
      const res = runMatching({
        antrag: makeAntragMit(5),  // DS
        primaerKategorie: 'IT',
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toEqual([]);
    });

    it('Override-Prioritaet: bevorzugt=[FuE,NW], override=[FuE] → NW raus', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        antragstypBevorzugt: ['FuE', 'NW'],
        antragstypUeberschreibung: ['FuE'],
      };
      // NW-Antrag (vb_phase=1) — vom Override raus
      const resNw = runMatching({
        antrag: makeAntragMit(1),
        primaerKategorie: 'IT',
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(resNw).toEqual([]);
      // FuE-Antrag — durch beide Praeferenzen erlaubt
      const resFue = runMatching({
        antrag: makeAntragMit(3),
        primaerKategorie: 'IT',
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(resFue).toHaveLength(1);
    });

    it('MA mit Kontingent über alle Typen bekommt jeden Antragstyp', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        // Volle Typ-Abdeckung → Ableitung = alle 4 Buckets → jeder Antragstyp matched.
        jahresKapazitaetProTyp: { FuE: 400, DS: 400, DL: 400, NW: 400 },
      };
      for (const phase of [1, 2, 3, 4, 5]) {
        const res = runMatching({
          antrag: makeAntragMit(phase),
          primaerKategorie: 'IT',
          config: makeConfig(),
          mitarbeiter: { MA01: m1 },
          zuweisungen: [],
          historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
          anonymMap: buildAnonymMapForTests([]),
        });
        expect(res).toHaveLength(1);
      }
    });

    it('v2.61: MA ohne Stunden-Kontingent wird ausgeschlossen (keine-stunden)', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        jahresKapazitaetProTyp: undefined, // keine Stunden → keine buchbare Ressource
      };
      const input = {
        antrag: makeAntragMit(3),
        primaerKategorie: 'IT',
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      };
      expect(runMatching(input)).toEqual([]);
      const ctx = runMatchingWithContext(input);
      expect(ctx.vorschlaege).toEqual([]);
      expect(ctx.ausgeschlossen).toContainEqual(
        expect.objectContaining({ anonId: 'MA01', grund: 'keine-stunden' }),
      );
    });

    it('Irrlaeufer (vb_phase=9) wird bei expliziter Praeferenz gefiltert', () => {
      const m1: AnonymerMitarbeiter = {
        ...makeMa('MA01', ['IT'], 1600, ['KI']),
        hauptKategorie: 'IT',
        antragstypBevorzugt: ['FuE', 'DS', 'DL', 'NW'],  // alle 4, aber expliziter Filter
      };
      const res = runMatching({
        antrag: makeAntragMit(9),
        primaerKategorie: 'IT',
        config: makeConfig(),
        mitarbeiter: { MA01: m1 },
        zuweisungen: [],
        historischeDeskriptorenByAnon: new Map([['MA01', ['ki']]]),
        anonymMap: buildAnonymMapForTests([]),
      });
      expect(res).toEqual([]);
    });
  });

  // Regression: „keine ähnlichen Projekte" für alle MA/alle Anträge.
  // aehnlicheProjekte (reine Anzeige) war an das Embedding-Scoring-Gate
  // (alpha < 1.0) gekoppelt. Da runBm25Matching auf [0,1] normalisiert (Top
  // immer 1.0), liefert computeAlpha bei jedem nicht-leeren BM25 alpha=1.0 →
  // Embedding-Stufe übersprungen → aehnlicheProjekte leer. Erwartung nach Fix:
  // ähnliche Projekte werden auch bei starkem BM25-Match (alpha=1.0) gefüllt.
  describe('aehnlicheProjekte unabhängig vom alpha-Gate', () => {
    // Historisches Projekt H1 des MA (tib_kuerz MUE → MA01), das dem aktuellen
    // Antrag embedding-ähnlich ist.
    const histAntrag = makeAntrag('H1', { tib_kuerz: 'MUE', titel: 'Alt-KI' } as Partial<Antrag>);
    const anonymMap = buildAnonymMapForTests([histAntrag]);
    const muerAnon = anonymMap.toAnon.get('MUE')!; // = MA01 (alphabetisch erstes Kürzel)

    function baseAehnlichInput() {
      const ma = { ...makeMa(muerAnon, ['IKT'], 1600, ['ki']), hauptKategorie: 'IKT' };
      return {
        antrag: makeAntrag('A_CUR', { verbund_titel: 'KI Projekt', vb_phase: 3 } as Partial<Antrag>),
        primaerKategorie: 'IKT',
        config: makeConfig({ stage2Aktiv: true }),
        mitarbeiter: { [muerAnon]: ma },
        zuweisungen: [],
        // BM25 trifft ('ki') → normalisiert Top=1.0 → alpha=1.0 (starker Match).
        historischeDeskriptorenByAnon: new Map([[muerAnon, ['ki']]]),
        anonymMap,
        // Stage-2-Eingaben: Query embedding-nah an H1.
        queryEmbedding: [1, 0, 0],
        corpusEmbeddings: new Map<string, number[]>([['H1', [1, 0, 0]]]),
        antraegeIndex: new Map([
          ['H1', { aktenzeichen: 'H1', tib_kuerz: 'MUE', titel: 'Alt-KI', vb_phase: 3 }],
        ]),
      };
    }

    it('alpha=1.0 (starker BM25) → aehnlicheProjekte trotzdem gefüllt', () => {
      const ctx = runMatchingWithContext(baseAehnlichInput());
      const top = ctx.vorschlaege[0]!;
      // Voraussetzung des Regressionstests: BM25 ist stark → alpha=1.0.
      expect(top.breakdown!.alpha).toBe(1.0);
      // Kern: ähnliches Alt-Projekt H1 wird dem MA angezeigt.
      expect(top.aehnlicheProjekte.length).toBeGreaterThan(0);
      expect(top.aehnlicheProjekte[0]!.aktenzeichen).toBe('H1');
    });

    it('Score-Parität: embeddingScore bleibt 0 bei alpha=1.0 (nur Anzeige entkoppelt)', () => {
      const ctx = runMatchingWithContext(baseAehnlichInput());
      // Phase A darf das Ranking NICHT ändern — der Embedding-Beitrag bleibt bei
      // alpha=1.0 genullt, nur die Anzeige-Liste kommt hinzu.
      expect(ctx.vorschlaege[0]!.embeddingScore).toBe(0);
    });
  });
});
