import { describe, it, expect } from 'vitest';
import {
  bearbeitungsdauerTage, dauerBucket, werteDauernAus, werteKnotenAus, zaehlePrognosen,
} from '@/core/meilensteine/auswertung';
import { bewerteVerbund } from '@/core/meilensteine/bewertung';
import { baueKontext } from '@/core/status';
import type { AbschlussFall } from '@/core/meilensteine/auswertung';
import type { MeilensteinPlan, VerbundMeilensteine } from '@/core/meilensteine/typen';

/** Ohne eigenen Anker fällt er mit dem Antragsdatum zusammen — der Normalfall ohne `D_XTE`. */
const fall = (p: Partial<AbschlussFall>): AbschlussFall => {
  const antragsdatum = p.antragsdatum === undefined ? '01.01.2026' : p.antragsdatum;
  return {
    verbundId: 'VB', typ: 'FuE', abschlussDatum: '01.03.2026', ...p,
    antragsdatum, anker: p.anker === undefined ? antragsdatum : p.anker,
  };
};

describe('bearbeitungsdauerTage', () => {
  it('rechnet Antragseingang bis Abschluss in Tagen', () => {
    expect(bearbeitungsdauerTage(fall({ antragsdatum: '01.01.2026', abschlussDatum: '31.01.2026' }))).toBe(30);
  });

  it('akzeptiert ISO und deutsches Format gemischt', () => {
    expect(bearbeitungsdauerTage(fall({ antragsdatum: '2026-01-01', abschlussDatum: '31.01.2026' }))).toBe(30);
  });

  it('liefert null bei fehlendem, unparsbarem oder verdrehtem Datum', () => {
    expect(bearbeitungsdauerTage(fall({ abschlussDatum: null }))).toBeNull();
    expect(bearbeitungsdauerTage(fall({ antragsdatum: 'demnächst' }))).toBeNull();
    expect(bearbeitungsdauerTage(fall({ antragsdatum: '01.03.2026', abschlussDatum: '01.01.2026' }))).toBeNull();
  });

  it('zählt ab dem Anker, nicht ab dem Antragsdatum', () => {
    // „alle Anträge da" kam zehn Tage nach dem Antragseingang — erst ab dann
    // läuft die Bearbeitung, also auch die Dauer.
    expect(bearbeitungsdauerTage(fall({
      antragsdatum: '01.01.2026', anker: '11.01.2026', abschlussDatum: '31.01.2026',
    }))).toBe(20);
  });
});

describe('dauerBucket', () => {
  it('klassifiziert an den Grenzen inklusiv', () => {
    expect(dauerBucket(60)).toBe('bis60');
    expect(dauerBucket(61)).toBe('bis90');
    expect(dauerBucket(90)).toBe('bis90');
    expect(dauerBucket(120)).toBe('bis120');
    expect(dauerBucket(121)).toBe('ueber120');
  });
});

describe('werteDauernAus', () => {
  const faelle: AbschlussFall[] = [
    fall({ verbundId: 'A', typ: 'FuE', antragsdatum: '01.01.2026', abschlussDatum: '31.01.2026' }), // 30
    fall({ verbundId: 'B', typ: 'FuE', antragsdatum: '01.01.2026', abschlussDatum: '01.04.2026' }), // 90
    fall({ verbundId: 'C', typ: 'DS', antragsdatum: '01.01.2026', abschlussDatum: '01.06.2026' }),  // 151
    fall({ verbundId: 'D', typ: null, antragsdatum: '01.01.2026', abschlussDatum: '31.01.2026' }),  // 30, typlos
    fall({ verbundId: 'E', typ: 'DL', abschlussDatum: null }),                                       // ohne Dauer
  ];

  it('bildet Durchschnitt, Median und Soll-Anteil über alle berechenbaren Fälle', () => {
    const { gesamt } = werteDauernAus(faelle, 90);
    expect(gesamt.anzahl).toBe(4);            // 30, 90, 151, 30
    expect(gesamt.durchschnittTage).toBe(75); // (30+90+151+30)/4 = 75.25 → 75
    expect(gesamt.medianTage).toBe(60);       // (30+90)/2
    expect(gesamt.anteilImSollProzent).toBe(75);
    expect(gesamt.abweichungTage).toBe(-15);
  });

  it('zählt typlose Fälle in die Gesamtzeile, aber in keine Typ-Zeile', () => {
    const { jeTyp } = werteDauernAus(faelle, 90);
    const summeTypen = jeTyp.reduce((s, t) => s + t.anzahl, 0);
    expect(summeTypen).toBe(3);
    expect(jeTyp.find(t => t.typ === 'FuE')!.anzahl).toBe(2);
    expect(jeTyp.find(t => t.typ === 'DS')!.anzahl).toBe(1);
  });

  it('liefert für jeden Antragstyp eine Zeile — auch ohne Fälle', () => {
    const { jeTyp } = werteDauernAus(faelle, 90);
    expect(jeTyp.map(t => t.typ)).toEqual(['FuE', 'DS', 'DL', 'NW']);
    const dl = jeTyp.find(t => t.typ === 'DL')!;
    expect(dl.anzahl).toBe(0);
    expect(dl.durchschnittTage).toBeNull();
    expect(dl.anteilImSollProzent).toBeNull();
  });

  it('verteilt auf die Dauer-Klassen', () => {
    const { gesamt } = werteDauernAus(faelle, 90);
    expect(gesamt.buckets).toEqual({ bis60: 2, bis90: 1, bis120: 0, ueber120: 1 });
  });
});

describe('werteKnotenAus', () => {
  const plan: MeilensteinPlan = {
    version: 1, stand: '2026-01-01', autor: null, status: 'freigegeben', gesamtfristTage: 90,
    knoten: [
      {
        id: 'k1', elternId: null, nummer: '1', label: 'Eingegeben', sollWoche: 2,
        relevantFuerFrist: true, nurTypen: [], aktiv: true, sortierung: 10,
        bedingung: { feldId: 'a', op: 'gefuellt' }, istDatumFeld: 'a',
      },
    ],
    historie: [],
  };

  const bewerte = (a: string | undefined, heute: string): VerbundMeilensteine =>
    bewerteVerbund(plan, {
      verbundId: 'VB', antragsdatum: '2026-01-05', anker: '2026-01-05', typ: 'FuE',
      kontext: baueKontext(a ? { a } : {}),
    }, heute);

  // Anker 05.01.2026, sollWoche 2 ⇒ Soll-Termin 19.01.2026.
  it('zählt erreicht, gerissen und die Reißquote', () => {
    const b = [
      bewerte('12.01.2026', '2026-02-01T00:00:00.000Z'), // erreicht, 7 Tage früh
      bewerte('26.01.2026', '2026-02-01T00:00:00.000Z'), // erreicht, 7 Tage spät
      bewerte(undefined, '2026-02-01T00:00:00.000Z'),    // gerissen
    ];
    const [k] = werteKnotenAus(plan, b);
    expect(k!.betrachtet).toBe(3);
    expect(k!.erreicht).toBe(2);
    expect(k!.gerissen).toBe(1);
    expect(k!.reissquoteProzent).toBe(33);
  });

  it('rechnet die Ist-Woche auf dieselbe Achse wie die Soll-Woche', () => {
    const b = [
      bewerte('19.01.2026', '2026-02-01T00:00:00.000Z'), // Abweichung 0
      bewerte('02.02.2026', '2026-02-05T00:00:00.000Z'), // Abweichung +14 Tage
    ];
    const [k] = werteKnotenAus(plan, b);
    expect(k!.abweichungWochen).toBe(1);     // Mittel 7 Tage
    expect(k!.durchschnittIstWoche).toBe(3); // Soll 2 + 1
  });

  it('mittelt Früh- und Spät-Abweichungen gegeneinander aus', () => {
    const b = [
      bewerte('12.01.2026', '2026-02-01T00:00:00.000Z'), // −7 Tage
      bewerte('26.01.2026', '2026-02-01T00:00:00.000Z'), // +7 Tage
    ];
    const [k] = werteKnotenAus(plan, b);
    expect(k!.abweichungWochen).toBe(0);
    expect(k!.durchschnittIstWoche).toBe(2);
  });

  it('lässt nicht relevante Knoten ganz aus der Zählung', () => {
    const nurDs: MeilensteinPlan = {
      ...plan,
      knoten: [{ ...plan.knoten[0]!, nurTypen: ['DS'] }],
    };
    const b = [bewerteVerbund(nurDs, {
      verbundId: 'VB', antragsdatum: '2026-01-05', anker: '2026-01-05', typ: 'FuE', kontext: baueKontext({}),
    }, '2026-02-01T00:00:00.000Z')];
    const [k] = werteKnotenAus(nurDs, b);
    expect(k!.betrachtet).toBe(0);
    expect(k!.reissquoteProzent).toBeNull();
  });
});

describe('zaehlePrognosen', () => {
  it('zählt jede Prognose-Stufe, auch die leeren', () => {
    const mk = (prognose: VerbundMeilensteine['prognose']): VerbundMeilensteine => ({
      verbundId: 'x', antragsdatum: null, anker: null, typ: null, wocheAktuell: null,
      fristDatum: null, restTage: null, ergebnisse: [], prognose,
    });
    expect(zaehlePrognosen([mk('imPlan'), mk('imPlan'), mk('nichtHaltbar')]))
      .toEqual({ imPlan: 2, gefaehrdet: 0, nichtHaltbar: 1, abgeschlossen: 0, unbekannt: 0 });
  });
});
