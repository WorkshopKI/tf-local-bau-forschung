/**
 * Die Zusage des Fristen-Widgets: **zusammen gezeigt, nicht zusammen gerechnet.**
 *
 * Geprüft wird genau das, was die Zusammenführung riskant macht — dass eine
 * gemeinsame Liste die Herkunft verwischt, die Sortierung zwei Maßstäbe mischt
 * oder ein nicht bezifferbarer Anlass stillschweigend verschwindet.
 */
import { describe, it, expect } from 'vitest';
import {
  anlassBilanz, bilanzText, buendleNachVerbund, meilensteinAnlaesse, sichtbareMischung,
  sortiereAnlaesse, ueberTageText, zieltagAnlass, type FristAnlass,
} from '../fristAnlaesse';
import type { WaechterErgebnis } from '@/core/status';
import type { MeilensteinKnoten, VerbundMeilensteine } from '@/core/meilensteine';

const HEUTE = new Date('2026-08-17T00:00:00.000Z').getTime();
const TAG = 86_400_000;
const iso = (offsetTage: number): string => new Date(HEUTE + offsetTage * TAG).toISOString();

function waechter(p: Partial<WaechterErgebnis> = {}): WaechterErgebnis {
  return {
    urteil: 'haengt', letzteAktivitaet: iso(-40), belegt: true, anstehend: null,
    tage: 40, zieltage: 21, grund: 'liegt zu lange', rolle: 'ab', paar: null, ...p,
  };
}

function knoten(id: string, nummer: string, label: string): MeilensteinKnoten {
  return {
    id, nummer, label, elternId: null, sollWoche: 2, relevantFuerFrist: true,
    nurTypen: [], aktiv: true, bedingung: { op: 'gesetzt', feld: 'antragsdatum' },
  } as unknown as MeilensteinKnoten;
}

function bewertung(verbundId: string, knotenId: string, zustand: string, sollTage: number): VerbundMeilensteine {
  return {
    verbundId,
    ergebnisse: [{ knotenId, zustand, sollDatum: iso(sollTage) }],
  } as unknown as VerbundMeilensteine;
}

describe('zieltagAnlass — der Stillstand wird eine Zeile', () => {
  it('trägt seine Herkunft und den Abstand zum Zieltag', () => {
    const a = zieltagAnlass('vb-1', 'ALPHA', 'NF gestellt', waechter());
    expect(a.marke, 'ohne Herkunft ist die Warnung nicht abstellbar').toBe('Zieltag');
    expect(a.art).toBe('zieltag');
    // 40 Tage still bei 21 Zieltagen = 19 darüber. NICHT die 40 selbst — das
    // wäre die Liegezeit, nicht der Fristverstoß.
    expect(a.ueberTage).toBe(19);
    expect(a.gerissen).toBe(true);
    expect(a.grund).toBe('NF gestellt');
  });

  it('nennt das halb offene Paar, wenn es eines gibt — es erklärt den Stau', () => {
    const a = zieltagAnlass('vb-1', 'ALPHA', 'techn geprüft', waechter({
      paar: { gesetzt: 'AT4', fehlt: 'AK4' } as WaechterErgebnis['paar'],
    }));
    expect(a.grund).toBe('AT4 gesetzt, AK4 fehlt');
  });

  it('beziffert NICHT, wenn eine der beiden Zahlen fehlt', () => {
    // Eine erfundene Zahl wäre schlimmer als keine: der Stillstand ist
    // festgestellt, sein Ausmaß nicht.
    expect(zieltagAnlass('v', 'A', 's', waechter({ zieltage: null })).ueberTage).toBeNull();
    expect(zieltagAnlass('v', 'A', 's', waechter({ tage: null })).ueberTage).toBeNull();
  });
});

describe('meilensteinAnlaesse — die Bewertung wird übernommen, nicht nachgebaut', () => {
  const k = [knoten('k1', '1.2', 'Zuweisung'), knoten('k2', '4', 'Gutachten')];
  const namen = (id: string): string => (id === 'vb-1' ? 'ALPHA' : 'BETA');

  it('nimmt nur gerissen und fällig — offen/erreicht sind keine Frist-Anlässe', () => {
    const b = [
      bewertung('vb-1', 'k1', 'gerissen', -12),
      bewertung('vb-2', 'k2', 'erreicht', -30),
    ];
    const out = meilensteinAnlaesse(b, k, namen, HEUTE);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ marke: '1.2', grund: 'Zuweisung', art: 'meilenstein' });
  });

  it('rechnet den Abstand in derselben Richtung wie der Zieltag: positiv = über', () => {
    const [ueber] = meilensteinAnlaesse([bewertung('vb-1', 'k1', 'gerissen', -12)], k, namen, HEUTE);
    expect(ueber?.ueberTage).toBe(12);
    expect(ueber?.gerissen).toBe(true);

    const [bevor] = meilensteinAnlaesse([bewertung('vb-1', 'k1', 'faellig', 5)], k, namen, HEUTE);
    expect(bevor?.ueberTage).toBe(-5);
    expect(bevor?.gerissen, 'fällig ist noch nicht gerissen').toBe(false);
  });

  it('überspringt einen Knoten, den der Plan nicht mehr führt', () => {
    const out = meilensteinAnlaesse([bewertung('vb-1', 'weg', 'gerissen', -1)], k, namen, HEUTE);
    expect(out).toEqual([]);
  });
});

describe('sortiereAnlaesse — ein Maßstab für beide Quellen', () => {
  const a = (id: string, ueberTage: number | null, akronym = 'X'): FristAnlass => ({
    id, verbundId: id, akronym, art: 'zieltag', marke: 'Zieltag',
    grund: '', ueberTage, gerissen: true,
  });

  it('am weitesten über der Frist zuerst — quellenübergreifend', () => {
    const sortiert = sortiereAnlaesse([a('a', 3), a('b', 19), a('c', -2)]);
    expect(sortiert.map(x => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('nicht bezifferbare sinken ans Ende, verschwinden aber NICHT', () => {
    const sortiert = sortiereAnlaesse([a('ohne', null), a('mit', -40)]);
    expect(sortiert.map(x => x.id)).toEqual(['mit', 'ohne']);
  });

  it('springt bei gleichem Abstand nicht — das Akronym entscheidet', () => {
    const sortiert = sortiereAnlaesse([a('1', 5, 'ZETA'), a('2', 5, 'ALPHA')]);
    expect(sortiert.map(x => x.akronym)).toEqual(['ALPHA', 'ZETA']);
  });
});

describe('buendleNachVerbund — eine Zeile je Vorgang', () => {
  const anlass = (
    verbundId: string, marke: string, ueberTage: number, art: FristAnlass['art'] = 'meilenstein',
  ): FristAnlass => ({
    id: `${art}:${verbundId}:${marke}`, verbundId, akronym: verbundId, art, marke,
    grund: marke, ueberTage, gerissen: true,
  });

  it('behält je Vorgang den dringendsten Anlass und zählt die übrigen', () => {
    // Am echten Bestand trugen die acht sichtbaren Zeilen des Widgets nur drei
    // verschiedene Akronyme — ein Vorgang, der seit Jahren liegt, reißt eben
    // einen Meilenstein nach dem anderen. Dasselbe Modul bündelte längst.
    const sortiert = sortiereAnlaesse([
      anlass('A', '1.1', 300), anlass('A', '1.2', 250), anlass('A', '2', 100),
      anlass('B', '1.1', 280),
    ]);
    const zeilen = buendleNachVerbund(sortiert);
    expect(zeilen.map(z => [z.akronym, z.marke, z.weitere])).toEqual([
      ['A', '1.1', 2],
      ['B', '1.1', 0],
    ]);
  });

  it('hält die Sortierung der Eingabe — es wird nicht ein zweites Mal sortiert', () => {
    const zeilen = buendleNachVerbund(sortiereAnlaesse([
      anlass('A', '1', 10), anlass('B', '1', 500), anlass('A', '2', 400),
    ]));
    expect(zeilen.map(z => z.akronym)).toEqual(['B', 'A']);
    expect(zeilen[1]!.ueberTage).toBe(400);   // der dringendste von A, nicht der erste
  });

  it('zieht Stillstand und Meilenstein desselben Vorgangs NICHT zusammen', () => {
    // Zwei Systeme, zwei Pflegeorte — eine gemeinsame Zeile nähme der Warnung
    // ihre Herkunft und damit den Weg, sie abzustellen.
    const zeilen = buendleNachVerbund([anlass('A', '1.1', 10), anlass('A', 'Zieltag', 5, 'zieltag')]);
    expect(zeilen).toHaveLength(2);
    expect(zeilen.map(z => z.art)).toEqual(['meilenstein', 'zieltag']);
  });
});

describe('ueberTageText', () => {
  it('unterscheidet über, heute, bevorstehend und unbezifferbar', () => {
    expect(ueberTageText(12)).toBe('12 T über');
    expect(ueberTageText(0)).toBe('heute');
    expect(ueberTageText(-5)).toBe('in 5 T');
    expect(ueberTageText(null)).toBe('—');
  });
});

describe('bilanzText — keine Quelle verschwindet in der Sortierung', () => {
  const z = (id: string): FristAnlass => ({
    id, verbundId: id, akronym: 'A', art: 'zieltag', marke: 'Zieltag',
    grund: '', ueberTage: 1, gerissen: true,
  });
  const m = (id: string): FristAnlass => ({ ...z(id), art: 'meilenstein', marke: '1.2' });

  it('nennt BEIDE Zahlen — am echten Bestand verdrängten 3.231 Meilensteine jeden Stillstand', () => {
    expect(anlassBilanz([z('a'), m('b'), m('c')])).toEqual({ zieltag: 1, meilenstein: 2 });
    expect(bilanzText([z('a'), m('b'), m('c')])).toBe('2 Meilenstein · 1 Zieltag');
  });

  it('nennt nur die Quelle, die etwas beisteuert — keine „0 Zieltag"-Zeile', () => {
    expect(bilanzText([m('b')])).toBe('1 Meilenstein');
    expect(bilanzText([z('a')])).toBe('1 Zieltag');
    expect(bilanzText([])).toBe('');
  });
});

describe('sichtbareMischung', () => {
  const anlass = (id: string, art: FristAnlass['art'], ueberTage: number): FristAnlass => ({
    id, verbundId: id, akronym: id, art, marke: art === 'zieltag' ? 'Zieltag' : '1',
    grund: 'x', ueberTage, gerissen: true,
  });

  it('beide Quellen kommen vor, auch wenn eine die Sortierung beherrscht', () => {
    // Der gemessene Fall: 36 Meilenstein-Anlässe gegen 16 Zieltage — in den
    // sichtbaren acht Zeilen kam kein einziger Zieltag vor, während die
    // Kopfzeile ihn zählte.
    const zeilen = [
      ...Array.from({ length: 10 }, (_, i) => anlass(`m${i}`, 'meilenstein', 300 - i)),
      anlass('z1', 'zieltag', 40),
      anlass('z2', 'zieltag', 30),
      anlass('z3', 'zieltag', 20),
    ];
    const sichtbar = sichtbareMischung(zeilen, 8, 2);
    expect(sichtbar).toHaveLength(8);
    expect(sichtbar.filter(z => z.art === 'zieltag').map(z => z.id)).toEqual(['z1', 'z2']);
    // Die Ausgabe-Reihenfolge bleibt die der Eingabe — ausgewählt, nicht umsortiert.
    expect(sichtbar.map(z => z.id)).toEqual(zeilen.filter(z => sichtbar.includes(z)).map(z => z.id));
  });

  it('passt alles hinein, bleibt alles stehen', () => {
    const zeilen = [anlass('a', 'zieltag', 5), anlass('b', 'meilenstein', 4)];
    expect(sichtbareMischung(zeilen, 8, 2)).toEqual(zeilen);
  });

  it('gibt es nur eine Quelle, bekommt sie alle Plätze', () => {
    const zeilen = Array.from({ length: 12 }, (_, i) => anlass(`m${i}`, 'meilenstein', 100 - i));
    const sichtbar = sichtbareMischung(zeilen, 8, 2);
    expect(sichtbar).toHaveLength(8);
    expect(sichtbar.map(z => z.id)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7']);
  });

  it('hält die Reserve klein — die Dringlichsten bleiben in der Mehrheit', () => {
    const zeilen = [
      ...Array.from({ length: 6 }, (_, i) => anlass(`m${i}`, 'meilenstein', 300 - i)),
      ...Array.from({ length: 6 }, (_, i) => anlass(`z${i}`, 'zieltag', 10 - i)),
    ];
    const sichtbar = sichtbareMischung(zeilen, 8, 2);
    expect(sichtbar.filter(z => z.art === 'meilenstein')).toHaveLength(6);
    expect(sichtbar.filter(z => z.art === 'zieltag')).toHaveLength(2);
  });
});
