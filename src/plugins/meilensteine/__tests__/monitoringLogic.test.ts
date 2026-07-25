import { describe, it, expect } from 'vitest';
import {
  LEERER_FILTER, filtereZeilen, nurMeinePunkte, sammleWochenPunkte,
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
