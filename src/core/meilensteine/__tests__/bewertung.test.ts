/**
 * Engine-Tests mit eingefrorener Uhr. Der Anker ist durchgehend der 05.01.2026
 * (ein Montag), damit sich Soll-Termine im Kopf nachrechnen lassen:
 * Woche 1 = 12.01., Woche 2 = 19.01., Woche 12 = 30.03.
 */
import { describe, it, expect } from 'vitest';
import { bewerteVerbund, planEndeTage, restTageBis } from '@/core/meilensteine/bewertung';
import { baueSeedPlan } from '@/core/meilensteine/seed';
import { baueKontext } from '@/core/status';
import type { Bedingung } from '@/core/status';
import type { MeilensteinKnoten, MeilensteinPlan } from '@/core/meilensteine/typen';

const ANKER = '2026-01-05';

function knoten(p: Partial<MeilensteinKnoten> & { id: string }): MeilensteinKnoten {
  return {
    elternId: null,
    nummer: p.id,
    label: p.id,
    sollWoche: 1,
    relevantFuerFrist: true,
    nurTypen: [],
    aktiv: true,
    // Eine ECHTE Bedingung als Vorgabe: gegen einen leeren Kontext ist sie
    // `false` — wie das frühere `{ einige: [] }` —, aber sie ist auswertbar.
    // Seit v4.134 ist der Unterschied entscheidend: eine leere Bedingung ist
    // kein „noch nicht", sondern ein „weiss ich nicht" (`ohneBedingung`).
    bedingung: { feldId: 'egal', op: 'gefuellt' } as Bedingung,
    sortierung: 10,
    ...p,
  };
}

function plan(knotenListe: MeilensteinKnoten[], gesamtfristTage = 90): MeilensteinPlan {
  return {
    version: 1, stand: ANKER, autor: null, status: 'freigegeben',
    gesamtfristTage, knoten: knotenListe, historie: [],
  };
}

const eingabe = (kontextFelder: Record<string, string>, extra: Record<string, unknown> = {}) => ({
  verbundId: 'VB-1',
  antragsdatum: ANKER,
  anker: ANKER,
  typ: null,
  kontext: baueKontext(kontextFelder),
  ...extra,
});

describe('bewerteVerbund — Zustände', () => {
  const p = plan([
    knoten({ id: 'k1', sollWoche: 1, bedingung: { feldId: 'a', op: 'gefuellt' }, istDatumFeld: 'a' }),
  ]);

  it('erreicht mit Ist-Datum und Abweichung gegen den Soll-Termin', () => {
    const r = bewerteVerbund(p, eingabe({ a: '06.01.2026' }), '2026-01-20T00:00:00.000Z');
    const e = r.ergebnisse[0]!;
    expect(e.zustand).toBe('erreicht');
    expect(e.sollDatum?.slice(0, 10)).toBe('2026-01-12');
    expect(e.istDatum).toBe('2026-01-06');
    expect(e.abweichungTage).toBe(-6);
  });

  it('gerissen, sobald der Soll-Termin überschritten ist', () => {
    const r = bewerteVerbund(p, eingabe({}), '2026-01-20T00:00:00.000Z');
    expect(r.ergebnisse[0]!.zustand).toBe('gerissen');
    expect(r.ergebnisse[0]!.istDatum).toBeNull();
  });

  it('fällig im 7-Tage-Fenster vor dem Soll-Termin, davor offen', () => {
    const faellig = plan([knoten({ id: 'k1', sollWoche: 3, bedingung: { feldId: 'a', op: 'gefuellt' } })]);
    const offen = plan([knoten({ id: 'k1', sollWoche: 4, bedingung: { feldId: 'a', op: 'gefuellt' } })]);
    const heute = '2026-01-20T00:00:00.000Z';
    expect(bewerteVerbund(faellig, eingabe({}), heute).ergebnisse[0]!.zustand).toBe('faellig');
    expect(bewerteVerbund(offen, eingabe({}), heute).ergebnisse[0]!.zustand).toBe('offen');
  });

  it('zählt inaktive Knoten nie als gerissen', () => {
    const inaktiv = plan([knoten({ id: 'k1', aktiv: false, bedingung: { feldId: 'a', op: 'gefuellt' } })]);
    const r = bewerteVerbund(inaktiv, eingabe({}), '2026-06-01T00:00:00.000Z');
    expect(r.ergebnisse[0]!.zustand).toBe('nichtRelevant');
  });

  it('blendet typ-fremde Knoten aus', () => {
    const nurFue = plan([knoten({ id: 'k1', nurTypen: ['FuE'], bedingung: { feldId: 'a', op: 'gefuellt' } })]);
    const alsDs = bewerteVerbund(nurFue, { ...eingabe({ a: '06.01.2026' }), typ: 'DS' }, '2026-01-20T00:00:00.000Z');
    const alsFue = bewerteVerbund(nurFue, { ...eingabe({ a: '06.01.2026' }), typ: 'FuE' }, '2026-01-20T00:00:00.000Z');
    expect(alsDs.ergebnisse[0]!.zustand).toBe('nichtRelevant');
    expect(alsFue.ergebnisse[0]!.zustand).toBe('erreicht');
  });

  it('nimmt ohne istDatumFeld das früheste Datum der erfüllenden Felder', () => {
    const p2 = plan([knoten({
      id: 'k1', sollWoche: 4,
      bedingung: { einige: [{ feldId: 'x', op: 'gefuellt' }, { feldId: 'y', op: 'gefuellt' }] },
    })]);
    const r = bewerteVerbund(p2, eingabe({ x: '20.01.2026', y: '08.01.2026' }), '2026-02-10T00:00:00.000Z');
    expect(r.ergebnisse[0]!.istDatum).toBe('2026-01-08');
  });

  it('rechnet Soll, Woche und Frist ab dem Anker, nicht ab dem Antragsdatum', () => {
    // Antrag am 05.01. eingegangen, „alle Anträge da" erst am 19.01. — bearbeitbar
    // ist der Verbund erst ab dann, also zählen alle Termine ab dem 19.01.
    const r = bewerteVerbund(p, { ...eingabe({}), anker: '2026-01-19' }, '2026-01-20T00:00:00.000Z');
    expect(r.anker?.slice(0, 10)).toBe('2026-01-19');
    expect(r.antragsdatum).toBe(ANKER);
    expect(r.ergebnisse[0]!.sollDatum?.slice(0, 10)).toBe('2026-01-26');
    expect(r.fristDatum?.slice(0, 10)).toBe('2026-04-19');
    expect(r.wocheAktuell).toBe(1);
  });

  it('liefert ohne Ankerdatum definierte Werte statt zu werfen', () => {
    const r = bewerteVerbund(p, { ...eingabe({}), antragsdatum: null, anker: null }, '2026-01-20T00:00:00.000Z');
    expect(r.ergebnisse[0]!.zustand).toBe('offen');
    expect(r.ergebnisse[0]!.sollDatum).toBeNull();
    expect(r.wocheAktuell).toBeNull();
    expect(r.restTage).toBeNull();
    expect(r.prognose).toBe('unbekannt');
  });

  it('zählt die laufende Bearbeitungswoche ab 1', () => {
    expect(bewerteVerbund(p, eingabe({}), '2026-01-05T00:00:00.000Z').wocheAktuell).toBe(1);
    expect(bewerteVerbund(p, eingabe({}), '2026-01-11T00:00:00.000Z').wocheAktuell).toBe(1);
    expect(bewerteVerbund(p, eingabe({}), '2026-01-12T00:00:00.000Z').wocheAktuell).toBe(2);
  });
});

describe('bewerteVerbund — Sammel-Knoten (Eltern-ODER-Regel)', () => {
  const p = plan([
    knoten({ id: 'p1', sollWoche: 5, relevantFuerFrist: false }),
    knoten({ id: 'c1', elternId: 'p1', sollWoche: 4, bedingung: { feldId: 'a', op: 'gefuellt' }, istDatumFeld: 'a' }),
    knoten({ id: 'c2', elternId: 'p1', sollWoche: 4, bedingung: { feldId: 'b', op: 'gefuellt' }, istDatumFeld: 'b' }),
  ]);
  const heute = '2026-02-20T00:00:00.000Z';
  const byId = (r: ReturnType<typeof bewerteVerbund>, id: string) =>
    r.ergebnisse.find(e => e.knotenId === id)!;

  it('bleibt offen, solange ein Kind fehlt', () => {
    const r = bewerteVerbund(p, eingabe({ a: '01.02.2026' }), heute);
    expect(byId(r, 'p1').zustand).toBe('gerissen');
  });

  it('ist erreicht, wenn alle relevanten Kinder erreicht sind — mit dem SPÄTESTEN Kind-Datum', () => {
    const r = bewerteVerbund(p, eingabe({ a: '01.02.2026', b: '05.02.2026' }), heute);
    const e = byId(r, 'p1');
    expect(e.zustand).toBe('erreicht');
    expect(e.ueberKinder).toBe(true);
    expect(e.istDatum).toBe('2026-02-05');
  });

  it('ignoriert inaktive Kinder bei der Eltern-Regel', () => {
    const mitInaktiv = plan([
      knoten({ id: 'p1', sollWoche: 5, relevantFuerFrist: false }),
      knoten({ id: 'c1', elternId: 'p1', bedingung: { feldId: 'a', op: 'gefuellt' }, istDatumFeld: 'a' }),
      knoten({ id: 'c2', elternId: 'p1', aktiv: false, bedingung: { feldId: 'b', op: 'gefuellt' } }),
    ]);
    const r = bewerteVerbund(mitInaktiv, eingabe({ a: '01.02.2026' }), heute);
    expect(byId(r, 'p1').zustand).toBe('erreicht');
  });

  it('überlebt einen Eltern-Zyklus ohne Endlosrekursion', () => {
    const zyklisch = plan([
      knoten({ id: 'k1', elternId: 'k2' }),
      knoten({ id: 'k2', elternId: 'k1' }),
    ]);
    const r = bewerteVerbund(zyklisch, eingabe({}), heute);
    expect(r.ergebnisse.map(e => e.zustand)).toEqual(['gerissen', 'gerissen']);
  });
});

describe('bewerteVerbund — Prognose zur Gesamtfrist', () => {
  // Ein früher und ein später fristrelevanter Meilenstein: der frühe erzeugt
  // Verzug, der späte markiert den Plan-Endpunkt (Woche 12 = 84 Tage).
  const p = plan([
    knoten({ id: 'frueh', sollWoche: 2, bedingung: { feldId: 'a', op: 'gefuellt' } }),
    knoten({ id: 'spaet', sollWoche: 12, bedingung: { feldId: 'z', op: 'gefuellt' } }),
  ]);

  it('imPlan, solange nichts gerissen oder fällig ist', () => {
    const r = bewerteVerbund(p, eingabe({ a: '06.01.2026' }), '2026-01-20T00:00:00.000Z');
    expect(r.prognose).toBe('imPlan');
  });

  it('gefährdet bei Verzug, der die Gesamtfrist rechnerisch noch zulässt', () => {
    // Soll „frueh" = 19.01.; heute 24.01. ⇒ 5 Tage Verzug ⇒ 84 + 5 = 89 ≤ 90.
    const r = bewerteVerbund(p, eingabe({}), '2026-01-24T00:00:00.000Z');
    expect(r.prognose).toBe('gefaehrdet');
  });

  it('nicht haltbar, sobald der Verzug den Plan über die Gesamtfrist schiebt', () => {
    // heute 29.01. ⇒ 10 Tage Verzug ⇒ 84 + 10 = 94 > 90, obwohl noch 66 Tage Restzeit.
    const r = bewerteVerbund(p, eingabe({}), '2026-01-29T00:00:00.000Z');
    expect(r.prognose).toBe('nichtHaltbar');
    expect(r.restTage).toBeGreaterThan(0);
  });

  it('nicht haltbar, wenn die Gesamtfrist selbst abgelaufen ist', () => {
    const r = bewerteVerbund(p, eingabe({ a: '06.01.2026' }), '2026-04-20T00:00:00.000Z');
    expect(r.restTage).toBeLessThan(0);
    expect(r.prognose).toBe('nichtHaltbar');
  });

  it('abgeschlossen, wenn alle fristrelevanten Blätter erreicht sind', () => {
    const r = bewerteVerbund(p, eingabe({ a: '06.01.2026', z: '01.03.2026' }), '2026-03-10T00:00:00.000Z');
    expect(r.prognose).toBe('abgeschlossen');
  });

  it('abgeschlossen bei terminalem Status, auch mit offenen Meilensteinen', () => {
    const r = bewerteVerbund(p, eingabe({}, { terminal: true }), '2026-03-10T00:00:00.000Z');
    expect(r.prognose).toBe('abgeschlossen');
  });

  it('unbekannt, wenn der Plan keinen fristrelevanten Blatt-Knoten hat', () => {
    const ohne = plan([knoten({ id: 'k1', relevantFuerFrist: false })]);
    expect(bewerteVerbund(ohne, eingabe({}), '2026-03-10T00:00:00.000Z').prognose).toBe('unbekannt');
  });

  it('zählt Sammel-Knoten nicht doppelt in die Prognose', () => {
    // Eltern (Woche 12) + Kind (Woche 2, gerissen): nur das Kind ist Blatt, der
    // Plan-Endpunkt kommt damit aus dem Kind — nicht aus dem Sammel-Knoten.
    const mitEltern = plan([
      knoten({ id: 'p1', sollWoche: 12, relevantFuerFrist: false }),
      knoten({ id: 'c1', elternId: 'p1', sollWoche: 2, bedingung: { feldId: 'a', op: 'gefuellt' } }),
    ]);
    const r = bewerteVerbund(mitEltern, eingabe({}), '2026-01-24T00:00:00.000Z');
    // Plan-Endpunkt 14 Tage + 5 Tage Verzug = 19 ≤ 90 ⇒ nur gefährdet.
    expect(r.prognose).toBe('gefaehrdet');
  });
});

describe('bewerteVerbund — Auslieferungs-Plan', () => {
  it('bewertet einen frisch eingegangenen Antrag als im Plan', () => {
    const p = baueSeedPlan();
    const r = bewerteVerbund(
      p,
      { verbundId: 'VB-1', antragsdatum: ANKER, anker: ANKER, typ: 'FuE', kontext: baueKontext({ antragsdatum: '05.01.2026' }) },
      '2026-01-08T00:00:00.000Z',
    );
    const mst11 = r.ergebnisse.find(e => e.knotenId === 'mst-1-1')!;
    expect(mst11.zustand).toBe('erreicht');
    expect(r.prognose).toBe('imPlan');
  });

  it('meldet einen alten, unbearbeiteten Antrag als nicht haltbar', () => {
    const p = baueSeedPlan();
    const r = bewerteVerbund(
      p,
      { verbundId: 'VB-2', antragsdatum: ANKER, anker: ANKER, typ: 'FuE', kontext: baueKontext({ antragsdatum: '05.01.2026' }) },
      '2026-03-01T00:00:00.000Z',
    );
    expect(r.prognose).toBe('nichtHaltbar');
    expect(r.ergebnisse.some(e => e.zustand === 'gerissen')).toBe(true);
  });

  it('liefert für jeden Plan-Knoten genau ein Ergebnis in Plan-Reihenfolge', () => {
    const p = baueSeedPlan();
    const r = bewerteVerbund(
      p,
      { verbundId: 'VB-3', antragsdatum: null, anker: null, typ: null, kontext: baueKontext({}) },
      '2026-03-01T00:00:00.000Z',
    );
    expect(r.ergebnisse.map(e => e.knotenId)).toEqual(p.knoten.map(k => k.id));
  });
});

describe('restTageBis', () => {
  const tag = (iso: string): number => new Date(iso).getTime();

  it('normalisiert `-0` zum heutigen Tag', () => {
    // Der Soll-Termin lag heute um Mitternacht, „jetzt" ist der Nachmittag:
    // `Math.ceil(-0.53)` ist `-0`, und `-0 < 0` ist `false`. Jede Anzeige, die
    // daran „überfällig oder nicht" entscheidet, schrieb daraus „in 0 T" — unter
    // der Überschrift „Überfällig".
    const r = restTageBis(tag('2026-08-19T00:00:00.000Z'), tag('2026-08-19T12:45:00.000Z'));
    expect(r).toBe(0);
    expect(Object.is(r, -0)).toBe(false);
  });

  it('rundet auf ganze Tage auf und zählt rückwärts negativ', () => {
    expect(restTageBis(tag('2026-08-26T00:00:00.000Z'), tag('2026-08-19T12:00:00.000Z'))).toBe(7);
    expect(restTageBis(tag('2026-08-12T00:00:00.000Z'), tag('2026-08-19T00:00:00.000Z'))).toBe(-7);
  });

  it('liefert ohne Ziel `null`', () => {
    expect(restTageBis(null, tag('2026-08-19T00:00:00.000Z'))).toBeNull();
    expect(restTageBis(Number.NaN, tag('2026-08-19T00:00:00.000Z'))).toBeNull();
  });
});

describe('planEndeTage', () => {
  it('nimmt die späteste fristrelevante BLATT-Woche', () => {
    const knotenListe = [
      knoten({ id: 'sammel', sollWoche: 4 }),
      knoten({ id: 'kind', elternId: 'sammel', sollWoche: 6 }),
      knoten({ id: 'spaet', sollWoche: 18 }),
    ];
    expect(planEndeTage(knotenListe)).toBe(18 * 7);
  });

  it('lässt stillgelegte und nicht fristrelevante Knoten außen vor', () => {
    expect(planEndeTage([
      knoten({ id: 'a', sollWoche: 4 }),
      knoten({ id: 'b', sollWoche: 30, aktiv: false }),
      knoten({ id: 'c', sollWoche: 40, relevantFuerFrist: false }),
    ])).toBe(4 * 7);
  });

  it('erkennt den in sich unerfüllbaren Plan', () => {
    // Genau der Fall des Auslieferungs-Plans: der letzte fristrelevante
    // Meilenstein liegt hinter der Gesamtfrist — damit ist JEDER Verbund
    // „nicht haltbar", ganz gleich wie er läuft.
    const p = plan([knoten({ id: 'a', sollWoche: 18 })], 90);
    expect(planEndeTage(p.knoten)).toBeGreaterThan(p.gesamtfristTage);
    const r = bewerteVerbund(p, eingabe({}), '2026-01-06T00:00:00.000Z');
    expect(r.prognose).toBe('nichtHaltbar');
  });

  it('ist 0, wenn kein Knoten in die Frist zählt', () => {
    expect(planEndeTage([])).toBe(0);
  });
});

describe('Knoten ohne auswertbare Bedingung (v4.134)', () => {
  const leer = (id: string, sollWoche: number): MeilensteinKnoten =>
    knoten({ id, sollWoche, bedingung: { einige: [] } as Bedingung });

  it('gilt als `ohneBedingung`, nicht als gerissen — auch lange nach der Soll-Woche', () => {
    // Der gemessene Fall: 4 der 11 aktiven Knoten des echten Plans trugen ein
    // leeres `einige` und meldeten fuer jeden Verbund einen Rueckstand.
    const r = bewerteVerbund(plan([leer('a', 1)]), eingabe({}), '2026-06-01T00:00:00.000Z');
    expect(r.ergebnisse[0]!.zustand).toBe('ohneBedingung');
  });

  it('auch ein leeres `alle` — es waere sonst dauerhaft ERREICHT ohne ein Datum', () => {
    const k = knoten({ id: 'a', bedingung: { alle: [] } as Bedingung });
    const r = bewerteVerbund(plan([k]), eingabe({}), '2026-06-01T00:00:00.000Z');
    expect(r.ergebnisse[0]!.zustand).toBe('ohneBedingung');
  });

  it('ein Sammel-Knoten MIT Kindern bleibt auswertbar', () => {
    const p = plan([
      knoten({ id: 'sammel', sollWoche: 4, bedingung: { einige: [] } as Bedingung }),
      knoten({ id: 'kind', elternId: 'sammel', sollWoche: 1, bedingung: { feldId: 'f', op: 'gefuellt' } }),
    ]);
    const offen = bewerteVerbund(p, eingabe({}), '2026-06-01T00:00:00.000Z');
    expect(offen.ergebnisse.find(e => e.knotenId === 'sammel')?.zustand).toBe('gerissen');
    const erfuellt = bewerteVerbund(p, eingabe({ f: '05.01.2026' }), '2026-06-01T00:00:00.000Z');
    expect(erfuellt.ergebnisse.find(e => e.knotenId === 'sammel')?.zustand).toBe('erreicht');
  });

  it('traegt nichts zur Prognose bei — weder Verzug noch Plan-Ende', () => {
    // Ohne diese Regel schoebe ein unerfuellbarer Knoten in Woche 18 das
    // Plan-Ende hinter die 90-Tage-Frist und JEDER Verbund waere „nicht haltbar".
    const p = plan([
      knoten({ id: 'echt', sollWoche: 2, bedingung: { feldId: 'f', op: 'gefuellt' } }),
      leer('luecke', 18),
    ], 90);
    expect(planEndeTage(p.knoten)).toBe(2 * 7);
    const r = bewerteVerbund(p, eingabe({ f: '05.01.2026' }), '2026-01-06T00:00:00.000Z');
    expect(r.prognose).toBe('abgeschlossen');
  });

  it('ein Plan NUR aus Luecken hat kein messbares Ende', () => {
    expect(planEndeTage([leer('a', 5), leer('b', 18)])).toBe(0);
  });
});
