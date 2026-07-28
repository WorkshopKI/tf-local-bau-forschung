import { describe, it, expect } from 'vitest';
import {
  LEERER_FILTER, antragsJahr, filtereZeilen, jahrChips, jahrSpanne, nurMeinePunkte,
  passtZuBereich, sammleWochenPunkte, setzeBis, setzeVon, standJahr, standardBereich,
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
describe('Jahrgang', () => {
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

  it('belegt mit laufendem Jahr und Vorjahr vor', () => {
    expect(standardBereich(2026)).toEqual({ von: 2025, bis: 2026 });
  });

  it('bietet die drei jüngsten Jahre zur Kurzwahl, neuestes zuerst', () => {
    expect(jahrChips(2026)).toEqual([2026, 2025, 2024]);
  });

  it('lässt ohne Bereich alles durch — auch Vorgänge ohne Antragsdatum', () => {
    expect(passtZuBereich(null, null)).toBe(true);
    expect(passtZuBereich('2013-03-03', null)).toBe(true);
  });

  it('schließt beide Grenzen ein', () => {
    const b = { von: 2025, bis: 2026 };
    expect(passtZuBereich('2025-01-01', b)).toBe(true);
    expect(passtZuBereich('2026-12-31', b)).toBe(true);
    expect(passtZuBereich('2024-12-31', b)).toBe(false);
    expect(passtZuBereich('2027-01-01', b)).toBe(false);
  });

  it('blendet Vorgänge ohne verwertbares Antragsdatum bei aktivem Bereich aus', () => {
    const b = { von: 2026, bis: 2026 };
    expect(passtZuBereich(null, b)).toBe(false);
    expect(passtZuBereich('kein Datum', b)).toBe(false);
  });

  it('zieht die Gegengrenze mit, statt den Bereich zu drehen', () => {
    expect(setzeVon({ von: 2025, bis: 2026 }, 2027)).toEqual({ von: 2027, bis: 2027 });
    expect(setzeVon({ von: 2025, bis: 2026 }, 2020)).toEqual({ von: 2020, bis: 2026 });
    expect(setzeBis({ von: 2025, bis: 2026 }, 2024)).toEqual({ von: 2024, bis: 2024 });
    expect(setzeBis({ von: 2025, bis: 2026 }, 2030)).toEqual({ von: 2025, bis: 2030 });
  });

  it('spannt die Auswahl über die Daten, mindestens aber über das laufende Jahr', () => {
    expect(jahrSpanne(['2013-01-01', '2020-06-01'], 2026)).toEqual({ von: 2013, bis: 2026 });
    expect(jahrSpanne(['2030-01-01'], 2026)).toEqual({ von: 2026, bis: 2030 });
    expect(jahrSpanne([null, 'x'], 2026)).toEqual({ von: 2026, bis: 2026 });
    expect(jahrSpanne([], 2026)).toEqual({ von: 2026, bis: 2026 });
  });

  it('hängt an keinem fest verdrahteten Jahr', () => {
    expect(passtZuBereich('2030-02-02', standardBereich(2031))).toBe(true);
    expect(passtZuBereich('2029-02-02', standardBereich(2031))).toBe(false);
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
      .toEqual(['NEU', 'VORJAHR']);
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
