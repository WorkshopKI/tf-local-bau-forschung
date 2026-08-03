/**
 * Das Erhebungsmaterial für den FB-Termin. Drei Auswertungen, drei Zusicherungen:
 *
 * 1. **Platzhalter** zählen nur, wo eine fremde Regel wirklich auf die Rolle
 *    wartet — und die Anzahl ist eine Untergrenze, keine Prognose.
 * 2. **Blinde Flecken** sind Vorgänge OHNE jedes To-do; einer mit To-do ist
 *    keiner mehr, egal wie offen sein Kürzel-Paar steht.
 * 3. **Determinismus**: bei festem Stichtag liefert dieselbe Eingabe dieselbe
 *    Ausgabe, Reihenfolge inklusive. Der Export wird zwischen Terminen
 *    verglichen; wackelte die Sortierung, wäre jeder Vergleich wertlos.
 */
import { describe, it, expect } from 'vitest';
import {
  erhebePlatzhalter, erhebeBlindeFlecken, erhebeKuerzelKarte,
} from '@/core/status/fb-erhebung';
import { baueTodoRegelSeed, feld } from '@/core/status/todo-regeln.seed';
import type { BedingungsKontext } from '@/core/status/bedingung';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type {
  MappingVersion, StatusFeldEintrag, TriggerZeile,
} from '@/core/status/typen';

const STICHTAG = '2026-08-01T00:00:00.000Z';
const REGELN = baueTodoRegelSeed();

function vorTagen(tage: number): string {
  const d = new Date(new Date(STICHTAG).getTime() - tage * 86_400_000);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}
const GESTERN = vorTagen(1);

function ctx(werte: Record<string, string>): BedingungsKontext {
  const m: BedingungsKontext = new Map();
  for (const [k, v] of Object.entries(werte)) m.set(feld(k), [v]);
  return m;
}

/** Ein Katalog-Feld mit Code und Rollen — die Form, die die Erhebung liest. */
function kfeld(code: string, label: string, rollen: StatusFeldEintrag['rollen']): StatusFeldEintrag {
  return {
    feldId: `D_${code}`, label, typ: 'datum', ebene: 'tv', code, rollen,
    prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
  };
}

const VERSION: MappingVersion = {
  version: 1, autor: null, zeitstempel: STICHTAG, werte: [],
  felder: [
    kfeld('AK4', 'Gutachten kaufm. fertig', ['ab']),
    kfeld('AT4', 'Gutachten techn. fertig', ['fb']),
    kfeld('ARK', 'RNE kaufm.', ['ab']),
    kfeld('ART', 'RNE techn.', ['fb']),
    kfeld('XPC+', 'PreCheck Verbund positiv', ['fb']),
  ],
};

/** Ein gesetztes Datum als Vorkommen. */
function vk(code: string, tage: number): FeldVorkommen {
  const f = VERSION.felder.find(x => x.code === code)!;
  return { feld: f, wert: vorTagen(tage) };
}

describe('(a) Abgeleitete Platzhalter', () => {
  it('gruppiert nach Herkunftsregel, mit Anzahl und Beispielen', () => {
    // R2 („Abl/RNE von FB abwarten") wartet auf FB.
    const e = erhebePlatzhalter([
      { aktenzeichen: 'A1', ctx: ctx({ 'XPC-': GESTERN }) },
      { aktenzeichen: 'A2', ctx: ctx({ 'XPC-': GESTERN }) },
      // R4 („SV in QS") wartet auf QS.
      { aktenzeichen: 'A3', ctx: ctx({ AVK: GESTERN }) },
    ], REGELN, STICHTAG);

    expect(e.gesamt).toBe(3);
    const fb = e.gruppen.find(g => g.rolle === 'fb');
    expect(fb?.quellRegelId).toBe('r2');
    expect(fb?.anzahl).toBe(2);
    expect(fb?.beispiele).toEqual(['A1', 'A2']);
    expect(e.gruppen.find(g => g.rolle === 'qs')?.quellRegelId).toBe('r4');
  });

  it('führt je Rolle eine Bilanz — Gesamtzahl UND abgeleiteter Anteil', () => {
    const e = erhebePlatzhalter([
      { aktenzeichen: 'A1', ctx: ctx({ 'XPC-': GESTERN }) },
    ], REGELN, STICHTAG);
    expect(e.proRolle).toEqual([
      { rolle: 'ab', todos: 1, abgeleitet: 0 },
      { rolle: 'fb', todos: 1, abgeleitet: 1 },
    ]);
  });

  it('zählt kein Warten auf den Antragsteller — das ist keine Rolle im Haus', () => {
    // R8 „RNE abwarten" wartet auf `ast`.
    const e = erhebePlatzhalter([
      { aktenzeichen: 'A1', ctx: ctx({ ARZ: vorTagen(10) }) },
    ], REGELN, STICHTAG);
    expect(e.gruppen).toEqual([]);
  });

  it('sortiert nach Häufigkeit, bei Gleichstand nach Kaskaden-Position', () => {
    const e = erhebePlatzhalter([
      { aktenzeichen: 'A1', ctx: ctx({ AVK: GESTERN }) },        // r4  → qs
      { aktenzeichen: 'A2', ctx: ctx({ 'XPC-': GESTERN }) },     // r2  → fb
    ], REGELN, STICHTAG);
    // Beide 1× — r2 (Position 40) steht vor r4 (Position 60).
    expect(e.gruppen.map(g => g.quellRegelId)).toEqual(['r2', 'r4']);
  });
});

describe('(b) Blinde Flecken', () => {
  it('meldet ein einseitig offenes Paar an einem Vorgang ohne jedes To-do', () => {
    const e = erhebeBlindeFlecken(
      [{ aktenzeichen: 'B1', vorkommen: [vk('AK4', 40)] }],
      VERSION, REGELN, STICHTAG,
    );
    expect(e.ohneTodo).toBe(1);
    expect(e.paare).toHaveLength(1);
    expect(e.paare[0]).toMatchObject({
      gesetzt: 'AK4', fehlt: 'AT4', rolle: 'fb', anzahl: 1, medianTage: 40,
    });
  });

  it('schweigt, wenn eine Regel greift — dann ist es kein blinder Fleck', () => {
    // `D_ART` gesetzt ⇒ R9 „RNE ergänzen" trifft, also kein blinder Fleck,
    // obwohl ARK/ART einseitig offen steht.
    const e = erhebeBlindeFlecken(
      [{ aktenzeichen: 'B1', vorkommen: [vk('ART', 40)] }],
      VERSION, REGELN, STICHTAG,
    );
    expect(e.gesamt).toBe(1);
    expect(e.ohneTodo).toBe(0);
    expect(e.paare).toEqual([]);
  });

  it('rechnet den Median über alle Vorgänge desselben Paares', () => {
    const e = erhebeBlindeFlecken([
      { aktenzeichen: 'B1', vorkommen: [vk('AK4', 10)] },
      { aktenzeichen: 'B2', vorkommen: [vk('AK4', 50)] },
      { aktenzeichen: 'B3', vorkommen: [vk('AK4', 30)] },
    ], VERSION, REGELN, STICHTAG);
    expect(e.paare[0]?.anzahl).toBe(3);
    expect(e.paare[0]?.medianTage).toBe(30);
  });

  it('braucht BEIDE Kürzel im Katalog — sonst hieße „leer" nur „nicht lesbar"', () => {
    const ohneGegenstueck: MappingVersion = {
      ...VERSION, felder: VERSION.felder.filter(f => f.code !== 'AT4'),
    };
    const e = erhebeBlindeFlecken(
      [{ aktenzeichen: 'B1', vorkommen: [vk('AK4', 40)] }],
      ohneGegenstueck, REGELN, STICHTAG,
    );
    expect(e.paare).toEqual([]);
  });
});

describe('(c) Kürzel-Landkarte', () => {
  const TRIGGER: TriggerZeile[] = [{
    programm: '76', kuerzel: 'AT4', folge: 1, prozedur: 'TRG.Status.TV.VB',
    parameterRoh: '', geparst: null, satz: 'Setzt den TV-Status auf 45.',
  }];

  it('listet nur die Kürzel der Rolle, absteigend nach Vorkommen', () => {
    const karte = erhebeKuerzelKarte(
      VERSION, new Map([['at4', 12], ['art', 3]]), TRIGGER, 'fb',
    );
    expect(karte.map(z => z.code)).toEqual(['AT4', 'ART', 'XPC+']);
    expect(karte[0]).toMatchObject({ vorkommen: 12, wirkung: ['Setzt den TV-Status auf 45.'] });
  });

  it('behält Kürzel ohne Vorkommen — „vorgesehen, nie gesetzt" ist ein Befund', () => {
    const karte = erhebeKuerzelKarte(VERSION, new Map(), [], 'fb');
    expect(karte).toHaveLength(3);
    expect(karte.every(z => z.vorkommen === 0)).toBe(true);
  });

  it('nimmt neutrale Kürzel nicht auf — sie darf jeder setzen', () => {
    const mitNeutral: MappingVersion = {
      ...VERSION, felder: [...VERSION.felder, kfeld('AN', 'Nachforderung an ASt', [])],
    };
    expect(erhebeKuerzelKarte(mitNeutral, new Map(), [], 'fb').map(z => z.code))
      .not.toContain('AN');
  });
});

describe('Determinismus', () => {
  it('derselbe Bestand liefert am selben Stichtag dasselbe Ergebnis', () => {
    const faelle = [
      { aktenzeichen: 'A1', ctx: ctx({ 'XPC-': GESTERN }) },
      { aktenzeichen: 'A2', ctx: ctx({ AVK: GESTERN }) },
    ];
    expect(erhebePlatzhalter(faelle, REGELN, STICHTAG))
      .toEqual(erhebePlatzhalter(faelle, REGELN, STICHTAG));

    const flecken = [
      { aktenzeichen: 'B1', vorkommen: [vk('AK4', 10)] },
      { aktenzeichen: 'B2', vorkommen: [vk('ARK', 20)] },
    ];
    expect(erhebeBlindeFlecken(flecken, VERSION, REGELN, STICHTAG))
      .toEqual(erhebeBlindeFlecken(flecken, VERSION, REGELN, STICHTAG));
  });
});
