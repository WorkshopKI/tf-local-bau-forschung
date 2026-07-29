import { describe, it, expect } from 'vitest';
import {
  LEERER_FILTER, antragsJahr, datumSpanne, filtereZeilen, gruppiereNachVerbund,
  jahrAlsBereich, jahrChips, nurMeinePunkte, passtZuBereich, sammleWochenPunkte,
  setzeBis, setzeVon, standJahr, standardBereich, standardFilter,
} from '@/plugins/meilensteine/monitoringLogic';
import type { VerbundZeile } from '@/plugins/meilensteine/useMeilensteinStand';
import type { MeilensteinPlan, MstErgebnis, Prognose } from '@/core/meilensteine';

const HEUTE = '2026-08-01T00:00:00.000Z';

function zeile(p: Partial<VerbundZeile> & { verbundId: string; prognose: Prognose }): VerbundZeile {
  return {
    akronym: p.verbundId, titel: '', kuerzel: [], antragsdatum: '2026-01-05',
    typ: 'FuE', wocheAktuell: 30, fristDatum: '2026-04-05', restTage: 10,
    ergebnisse: [], ...p,
  };
}

function ergebnis(p: Partial<MstErgebnis> & { knotenId: string }): MstErgebnis {
  return { zustand: 'offen', sollDatum: null, istDatum: null, abweichungTage: null, ...p };
}

const plan: MeilensteinPlan = {
  version: 1, stand: HEUTE, autor: null, status: 'freigegeben', gesamtfristTage: 90,
  knoten: [
    {
      id: 'k1', elternId: null, nummer: '1', label: 'Vollständigkeit', sollWoche: 2,
      relevantFuerFrist: true, nurTypen: [], aktiv: true, bedingung: { einige: [] }, sortierung: 10,
    },
    {
      id: 'k2', elternId: null, nummer: '2', label: 'Gutachten', sollWoche: 9,
      relevantFuerFrist: true, nurTypen: [], aktiv: true, bedingung: { einige: [] }, sortierung: 20,
    },
  ],
  historie: [],
};

/**
 * Bezugsjahr ist überall Parameter — kein `vi.setSystemTime` nötig. Die Uhr wird
 * nicht mockbar gemacht, sondern aus den Funktionen entfernt.
 */
describe('Eingangs-Zeitraum', () => {
  it('liest das Jahr aus ISO, deutschem und zweistelligem Datum', () => {
    expect(antragsJahr('2026-01-05')).toBe(2026);
    expect(antragsJahr('05.01.2026')).toBe(2026);
    expect(antragsJahr('05.01.26')).toBe(2026);
  });

  it('liest das Jahr auch aus einem ISO-Zeitstempel (Bewertungs-Stand)', () => {
    expect(antragsJahr('2026-07-28T10:00:00.000Z')).toBe(2026);
    expect(standJahr(HEUTE)).toBe(2026);
  });

  it('liefert ohne verwertbares Datum null', () => {
    expect(antragsJahr(null)).toBeNull();
    expect(antragsJahr('')).toBeNull();
    expect(antragsJahr('demnächst')).toBeNull();
    expect(antragsJahr('32.13.2026')).toBeNull();
  });

  it('belegt mit dem laufenden Jahr vor — deckungsgleich mit dem ersten Chip', () => {
    expect(standardBereich(2026)).toEqual({ von: '2026-01-01', bis: '2026-12-31' });
    expect(standardBereich(2026)).toEqual(jahrAlsBereich(2026));
  });

  it('legt hinter einen Jahres-Chip das volle Kalenderjahr', () => {
    expect(jahrAlsBereich(2024)).toEqual({ von: '2024-01-01', bis: '2024-12-31' });
  });

  it('bietet die drei jüngsten Jahre zur Kurzwahl, neuestes zuerst', () => {
    expect(jahrChips(2026)).toEqual([2026, 2025, 2024]);
  });

  it('lässt ohne Bereich alles durch — auch Vorgänge ohne Antragsdatum', () => {
    expect(passtZuBereich(null, null)).toBe(true);
    expect(passtZuBereich('2013-03-03', null)).toBe(true);
  });

  it('schließt beide Grenzen ein', () => {
    const b = standardBereich(2026);
    expect(passtZuBereich('2026-01-01', b)).toBe(true);
    expect(passtZuBereich('2026-12-31', b)).toBe(true);
    expect(passtZuBereich('2025-12-31', b)).toBe(false);
    expect(passtZuBereich('2027-01-01', b)).toBe(false);
  });

  it('trennt taggenau, nicht nur jahrweise', () => {
    const q2 = { von: '2026-04-01', bis: '2026-06-30' };
    expect(passtZuBereich('2026-03-31', q2)).toBe(false);
    expect(passtZuBereich('2026-04-01', q2)).toBe(true);
    expect(passtZuBereich('2026-06-30', q2)).toBe(true);
    expect(passtZuBereich('2026-07-01', q2)).toBe(false);
  });

  it('vergleicht deutsche Datumsangaben taggenau mit', () => {
    const b = { von: '2025-08-17', bis: '2025-08-19' };
    expect(passtZuBereich('16.08.2025', b)).toBe(false);
    expect(passtZuBereich('17.08.2025', b)).toBe(true);
    expect(passtZuBereich('19.08.25', b)).toBe(true);
    expect(passtZuBereich('20.08.2025', b)).toBe(false);
  });

  it('blendet Vorgänge ohne verwertbares Antragsdatum bei aktivem Bereich aus', () => {
    const b = jahrAlsBereich(2026);
    expect(passtZuBereich(null, b)).toBe(false);
    expect(passtZuBereich('kein Datum', b)).toBe(false);
  });

  it('zieht die Gegengrenze mit, statt den Bereich zu drehen', () => {
    const b = { von: '2025-01-01', bis: '2026-12-31' };
    expect(setzeVon(b, '2027-03-01')).toEqual({ von: '2027-03-01', bis: '2027-03-01' });
    expect(setzeVon(b, '2020-06-15')).toEqual({ von: '2020-06-15', bis: '2026-12-31' });
    expect(setzeBis(b, '2024-05-05')).toEqual({ von: '2024-05-05', bis: '2024-05-05' });
    expect(setzeBis(b, '2030-01-31')).toEqual({ von: '2025-01-01', bis: '2030-01-31' });
  });

  it('spannt die Grenzen über die Daten, mindestens über das laufende Jahr', () => {
    expect(datumSpanne(['2013-04-17', '2020-06-01'], 2026))
      .toEqual({ von: '2013-04-17', bis: '2026-12-31' });
    expect(datumSpanne(['2030-02-09'], 2026))
      .toEqual({ von: '2026-01-01', bis: '2030-02-09' });
    expect(datumSpanne([null, 'x'], 2026)).toEqual({ von: '2026-01-01', bis: '2026-12-31' });
    expect(datumSpanne([], 2026)).toEqual({ von: '2026-01-01', bis: '2026-12-31' });
  });

  it('hängt an keinem fest verdrahteten Jahr', () => {
    expect(passtZuBereich('2031-02-02', standardBereich(2031))).toBe(true);
    expect(passtZuBereich('2030-02-02', standardBereich(2031))).toBe(false);
  });

  it('grenzt eine Zeilen-Liste ein wie die Seite es tut', () => {
    const zeilen = [
      zeile({ verbundId: 'NEU', prognose: 'imPlan', antragsdatum: '2026-03-01' }),
      zeile({ verbundId: 'VORJAHR', prognose: 'imPlan', antragsdatum: '17.08.2025' }),
      zeile({ verbundId: 'ALT', prognose: 'nichtHaltbar', antragsdatum: '2014-05-05' }),
      zeile({ verbundId: 'OHNE', prognose: 'unbekannt', antragsdatum: null }),
    ];
    const b = standardBereich(2026);
    expect(zeilen.filter(z => passtZuBereich(z.antragsdatum, b)).map(z => z.verbundId))
      .toEqual(['NEU']);
    expect(zeilen.filter(z => passtZuBereich(z.antragsdatum, jahrAlsBereich(2025))).map(z => z.verbundId))
      .toEqual(['VORJAHR']);
    expect(zeilen.filter(z => passtZuBereich(z.antragsdatum, null))).toHaveLength(4);
  });
});

describe('filtereZeilen', () => {
  const zeilen = [
    zeile({ verbundId: 'AAA', prognose: 'imPlan', restTage: 40 }),
    zeile({ verbundId: 'BBB', prognose: 'nichtHaltbar', restTage: 60 }),
    zeile({ verbundId: 'CCC', prognose: 'gefaehrdet', restTage: 5, typ: 'DS', kuerzel: ['THÜ'] }),
    zeile({ verbundId: 'DDD', prognose: 'abgeschlossen', restTage: 1 }),
  ];

  it('sortiert nach Dringlichkeit — Prognose schlägt Restzeit', () => {
    const r = filtereZeilen(zeilen, LEERER_FILTER, '');
    expect(r.map(z => z.verbundId)).toEqual(['BBB', 'CCC', 'AAA', 'DDD']);
  });

  it('filtert nach Antragstyp', () => {
    const r = filtereZeilen(zeilen, { ...LEERER_FILTER, typen: ['DS'] }, '');
    expect(r.map(z => z.verbundId)).toEqual(['CCC']);
  });

  it('filtert nach Prognose (Mehrfachauswahl)', () => {
    const r = filtereZeilen(zeilen, { ...LEERER_FILTER, prognosen: ['imPlan', 'gefaehrdet'] }, '');
    expect(r.map(z => z.verbundId)).toEqual(['CCC', 'AAA']);
  });

  it('sucht über Akronym, Titel und Verbund-ID', () => {
    const mitTitel = [zeile({ verbundId: 'X1', prognose: 'imPlan', titel: 'Wasserstoff-Speicher' })];
    expect(filtereZeilen(mitTitel, { ...LEERER_FILTER, suche: 'wasserstoff' }, '')).toHaveLength(1);
    expect(filtereZeilen(mitTitel, { ...LEERER_FILTER, suche: 'x1' }, '')).toHaveLength(1);
    expect(filtereZeilen(mitTitel, { ...LEERER_FILTER, suche: 'nix' }, '')).toHaveLength(0);
  });

  it('grenzt „nur meine" NFC-normalisiert auf das eigene Kürzel ein', () => {
    const r = filtereZeilen(zeilen, { ...LEERER_FILTER, nurMeine: true }, 'THÜ'.normalize('NFD'));
    expect(r.map(z => z.verbundId)).toEqual(['CCC']);
  });

  it('liefert bei „nur meine" ohne eigenes Kürzel nichts, statt alles', () => {
    expect(filtereZeilen(zeilen, { ...LEERER_FILTER, nurMeine: true }, '')).toEqual([]);
  });

  it('startet mit „nur meine", sobald ein eigenes Kürzel gesetzt ist — sonst ohne', () => {
    expect(standardFilter(true)).toEqual({ ...LEERER_FILTER, nurMeine: true });
    // Ohne Kürzel MUSS der Standard aus sein, sonst wäre die Liste leer.
    expect(standardFilter(false)).toEqual(LEERER_FILTER);
    expect(filtereZeilen(zeilen, standardFilter(false), '')).toHaveLength(zeilen.length);
  });
});

describe('sammleWochenPunkte', () => {
  const zeilen = [
    zeile({
      verbundId: 'AAA', prognose: 'nichtHaltbar', kuerzel: ['ABC'],
      ergebnisse: [
        ergebnis({ knotenId: 'k1', zustand: 'gerissen', sollDatum: '2026-07-20T00:00:00.000Z' }),
        ergebnis({ knotenId: 'k2', zustand: 'offen', sollDatum: '2026-09-01T00:00:00.000Z' }),
      ],
    }),
    zeile({
      verbundId: 'BBB', prognose: 'gefaehrdet',
      ergebnisse: [ergebnis({ knotenId: 'k2', zustand: 'faellig', sollDatum: '2026-08-05T00:00:00.000Z' })],
    }),
    zeile({
      verbundId: 'CCC', prognose: 'imPlan',
      ergebnisse: [ergebnis({ knotenId: 'k1', zustand: 'erreicht' })],
    }),
  ];

  it('sammelt nur gerissene und fällige Meilensteine', () => {
    const p = sammleWochenPunkte(zeilen, plan, HEUTE);
    expect(p.map(x => `${x.verbundId}:${x.knotenId}`)).toEqual(['AAA:k1', 'BBB:k2']);
  });

  it('rechnet die Restzeit vorzeichenrichtig (negativ = überfällig)', () => {
    const p = sammleWochenPunkte(zeilen, plan, HEUTE);
    expect(p[0]!.restTage).toBe(-12);
    expect(p[1]!.restTage).toBe(4);
  });

  it('reicht Nummer und Bezeichnung aus dem Plan durch', () => {
    const p = sammleWochenPunkte(zeilen, plan, HEUTE);
    expect(p[0]!.nummer).toBe('1');
    expect(p[0]!.label).toBe('Vollständigkeit');
  });

  it('überspringt Ergebnisse ohne Knoten im Plan', () => {
    const verwaist = [zeile({
      verbundId: 'X', prognose: 'imPlan',
      ergebnisse: [ergebnis({ knotenId: 'gibtesnicht', zustand: 'gerissen', sollDatum: HEUTE })],
    })];
    expect(sammleWochenPunkte(verwaist, plan, HEUTE)).toEqual([]);
  });
});

describe('nurMeinePunkte', () => {
  it('filtert auf das eigene Kürzel', () => {
    const punkte = sammleWochenPunkte([
      zeile({
        verbundId: 'AAA', prognose: 'gefaehrdet', kuerzel: ['ABC'],
        ergebnisse: [ergebnis({ knotenId: 'k1', zustand: 'gerissen', sollDatum: HEUTE })],
      }),
      zeile({
        verbundId: 'BBB', prognose: 'gefaehrdet', kuerzel: ['XYZ'],
        ergebnisse: [ergebnis({ knotenId: 'k1', zustand: 'gerissen', sollDatum: HEUTE })],
      }),
    ], plan, HEUTE);
    expect(nurMeinePunkte(punkte, 'ABC').map(p => p.verbundId)).toEqual(['AAA']);
  });

  it('lässt ohne eigenes Kürzel alles stehen', () => {
    const punkte = sammleWochenPunkte([
      zeile({
        verbundId: 'AAA', prognose: 'gefaehrdet',
        ergebnisse: [ergebnis({ knotenId: 'k1', zustand: 'gerissen', sollDatum: HEUTE })],
      }),
    ], plan, HEUTE);
    expect(nurMeinePunkte(punkte, '')).toHaveLength(1);
  });
});

describe('gruppiereNachVerbund', () => {
  /** Eigener Plan: der geteilte kennt nur k1/k2, hier braucht es einen dritten Knoten. */
  const planMitK3: MeilensteinPlan = {
    ...plan,
    knoten: [
      ...plan.knoten,
      {
        id: 'k3', elternId: null, nummer: '3', label: 'Bescheid', sollWoche: 12,
        relevantFuerFrist: true, nurTypen: [], aktiv: true, bedingung: { einige: [] }, sortierung: 30,
      },
    ],
  };

  /** AAA mit drei gerissenen Meilensteinen (−61 / −22 / −7 Tage), BBB mit einem (−12). */
  const punkte = sammleWochenPunkte([
    zeile({
      verbundId: 'AAA', prognose: 'nichtHaltbar', titel: 'Alt-Vorhaben',
      ergebnisse: [
        ergebnis({ knotenId: 'k2', zustand: 'gerissen', sollDatum: '2026-07-10T00:00:00.000Z' }),
        ergebnis({ knotenId: 'k1', zustand: 'gerissen', sollDatum: '2026-06-01T00:00:00.000Z' }),
        ergebnis({ knotenId: 'k3', zustand: 'gerissen', sollDatum: '2026-07-25T00:00:00.000Z' }),
      ],
    }),
    zeile({
      verbundId: 'BBB', prognose: 'gefaehrdet',
      ergebnisse: [ergebnis({ knotenId: 'k1', zustand: 'gerissen', sollDatum: '2026-07-20T00:00:00.000Z' })],
    }),
  ], planMitK3, HEUTE);

  it('macht aus mehreren Punkten eines Verbunds eine Zeile', () => {
    const gruppen = gruppiereNachVerbund(punkte);
    expect(gruppen.map(g => g.verbundId)).toEqual(['AAA', 'BBB']);
    expect(gruppen[0]!.punkte).toHaveLength(3);
    expect(gruppen[1]!.punkte).toHaveLength(1);
  });

  it('nennt als dringendsten den ältesten Punkt — die Stelle, an der es hängt', () => {
    const gruppen = gruppiereNachVerbund(punkte);
    expect(gruppen[0]!.dringendster.knotenId).toBe('k1');       // Soll 1.6., nicht 10.7.
    expect(gruppen[0]!.dringendster.restTage).toBe(-61);
  });

  it('ordnet die Gruppen nach ihrem dringendsten Punkt, nicht nach ihrer Größe', () => {
    // AAA führt mit −61, obwohl BBBs einziger Punkt (−12) dringender ist als
    // AAAs zweit- und drittältester.
    expect(gruppiereNachVerbund(punkte).map(g => g.verbundId)).toEqual(['AAA', 'BBB']);
    // Bleibt AAA nur der jüngste Punkt (−7), rutscht BBB (−12) davor.
    const nurK3 = punkte.filter(p => p.verbundId !== 'AAA' || p.knotenId === 'k3');
    expect(gruppiereNachVerbund(nurK3).map(g => g.verbundId)).toEqual(['BBB', 'AAA']);
  });

  it('trägt Akronym und Titel des Verbunds mit', () => {
    const [aaa] = gruppiereNachVerbund(punkte);
    expect(aaa!.akronym).toBe('AAA');
    expect(aaa!.titel).toBe('Alt-Vorhaben');
  });

  it('verliert keinen Punkt und kommt mit einer leeren Liste klar', () => {
    const summe = gruppiereNachVerbund(punkte).reduce((n, g) => n + g.punkte.length, 0);
    expect(summe).toBe(punkte.length);
    expect(gruppiereNachVerbund([])).toEqual([]);
  });
});
