/**
 * Die **Bandgeometrie** — die eine Zusage, ohne die eine mehrspurige Bahn
 * nichts vergleichbar macht: *derselbe Tag sitzt in jeder Spur an derselben
 * x-Position*.
 *
 * Alles andere in dieser Datei folgt daraus. Mindestbreite und Stauchung machen
 * die Achse nicht-linear; würde man sie je Spur berechnen, liefen die Spuren
 * auseinander und die Bahn zeigte Gleichzeitigkeit, wo keine ist.
 */
import { describe, it, expect } from 'vitest';
import type { VerlaufsSegment, VerlaufsSpur } from '@/core/status/verlauf';
import {
  baueBandGeometrie, buendle, spurSignatur, dauerText, tageZwischen,
  imFenster, xFuerTag, MIN_INTERVALL, BUENDEL_AB, bodenFuer,
} from '@/plugins/antraege/verlauf-band/bandGeometrie';

const BEZUG = '2026-08-07';

function seg(von: string | null, bis: string | null, code = 31): VerlaufsSegment {
  return {
    statusRef: { roh: `s${code}`, code, kurz: `S${code}`, lang: `s${code}`, labelHerkunft: 'katalog' },
    vonDatum: von,
    bisDatum: bis,
    dauerTage: tageZwischen(von, bis),
    dauerUnsicher: von === null || bis === null,
  };
}

function spur(id: string, art: 'tv' | 'verbund', segmente: VerlaufsSegment[]): VerlaufsSpur {
  return {
    art, id, zustand: 'verlauf', herkunft: 'abgeleitet',
    segmente, uebergaenge: [], journalAb: null, projektform: { art: 'bekannt', form: 'NW' },
  };
}

describe('Eine Achse für alle Spuren', () => {
  it('setzt denselben Tag in jeder Spur an dieselbe x-Position', () => {
    // Zwei Spuren mit VERSCHIEDENEN Segmenten, aber einer gemeinsamen Grenze.
    const g = baueBandGeometrie([
      spur('vb', 'verbund', [seg('2024-01-01', '2024-06-01'), seg('2024-06-01', BEZUG)]),
      spur('tv1', 'tv', [seg('2024-01-01', '2024-03-01'), seg('2024-03-01', '2024-06-01'),
        seg('2024-06-01', BEZUG)]),
    ], BEZUG, 800);

    const vb = g.spuren.find(s => s.spur.id === 'vb')!;
    const tv = g.spuren.find(s => s.spur.id === 'tv1')!;
    // 2024-06-01 ist in beiden Spuren eine Segmentgrenze.
    expect(vb.segmente[1]!.links).toBeCloseTo(tv.segmente[2]!.links, 5);
    // Und beide enden am Bezugszeitpunkt.
    expect(vb.segmente[1]!.links + vb.segmente[1]!.breite)
      .toBeCloseTo(tv.segmente[2]!.links + tv.segmente[2]!.breite, 5);
  });

  it('hält jedes Segment über der Klickgrenze, auch bei Tageswechseln', () => {
    // Drei Wechsel an aufeinanderfolgenden Tagen neben einem Sieben-Jahres-Block.
    const g = baueBandGeometrie([
      spur('tv1', 'tv', [
        seg('2019-01-01', '2026-01-01'),
        seg('2026-01-01', '2026-01-02'),
        seg('2026-01-02', '2026-01-03'),
        seg('2026-01-03', BEZUG),
      ]),
    ], BEZUG, 800);
    for (const s of g.spuren[0]!.segmente) {
      expect(s.breite).toBeGreaterThanOrEqual(MIN_INTERVALL - 0.01);
    }
  });

  it('markiert das Langsegment, wenn viele Mindestbreiten es zusammendrücken', () => {
    // Zwanzig Tageswechsel fordern je 24 px; der Sieben-Jahres-Block gibt sie
    // her und behält am Ende selbst nur das Mindestmaß. DANN sagt seine Länge
    // nichts mehr über seine Dauer — und genau das muss dranstehen.
    const kurze = Array.from({ length: 20 }, (_, i) =>
      seg(`2026-01-${String(i + 1).padStart(2, '0')}`, `2026-01-${String(i + 2).padStart(2, '0')}`));
    const g = baueBandGeometrie([
      spur('tv1', 'tv', [seg('2019-01-01', '2026-01-01'), ...kurze]),
    ], BEZUG, 300);
    expect(g.spuren[0]!.segmente[0]!.gestaucht).toBe(true);
    expect(g.spuren[0]!.segmente.slice(1).every(s => !s.gestaucht)).toBe(true);
  });

  it('markiert NICHT, wo die Achse nahezu linear bleibt', () => {
    // Dieselbe Form, aber nur zwei kurze Segmente: das Langsegment behält gut
    // drei Viertel der Bahn. Ein Bruchzeichen wäre hier Rauschen — die Marke
    // muss etwas bedeuten, sonst liest sie niemand mehr.
    const g = baueBandGeometrie([
      spur('tv1', 'tv', [
        seg('2019-01-01', '2026-01-01'),
        seg('2026-01-01', '2026-01-02'),
        seg('2026-01-02', BEZUG),
      ]),
    ], BEZUG, 200);
    expect(g.spuren[0]!.segmente.every(s => !s.gestaucht)).toBe(true);
  });

  it('wächst über den Container hinaus, statt Segmente zu zerdrücken', () => {
    const segmente = Array.from({ length: 30 }, (_, i) =>
      seg(`2026-01-${String(i + 1).padStart(2, '0')}`, `2026-01-${String(i + 2).padStart(2, '0')}`));
    const g = baueBandGeometrie([spur('tv1', 'tv', segmente)], BEZUG, 300);
    expect(g.breite).toBeGreaterThan(300);
    expect(g.breite).toBeGreaterThanOrEqual(30 * MIN_INTERVALL);
  });

  it('gibt den Abschnitten mehr Boden, wenn die Bahn breiter wird', () => {
    // Der Kern von v3.38: bis dahin klebte der Boden bei 24 px, auch wenn 1000
    // zur Verfügung standen — sechs Abschnitte drängten sich auf ~130 px,
    // während einer ~700 bekam.
    const segmente = [
      seg('2019-01-01', '2026-01-01'),
      seg('2026-01-01', '2026-01-02'),
      seg('2026-01-02', '2026-01-03'),
      seg('2026-01-03', BEZUG),
    ];
    const kleinstes = (vorgabe: number): number => Math.min(
      ...baueBandGeometrie([spur('tv1', 'tv', segmente)], BEZUG, vorgabe)
        .spuren[0]!.segmente.map(s => s.breite),
    );
    expect(kleinstes(1000)).toBeGreaterThan(kleinstes(300));
    expect(kleinstes(300)).toBeGreaterThanOrEqual(MIN_INTERVALL);
  });

  it('fällt bei vielen Grenzen auf das Mindestmaß zurück', () => {
    // Dort passt ohnehin kein Text mehr, und ein hoher Boden schöbe die Bahn
    // nur in den Scroll. Der Deckel ist also keine Sparsamkeit, sondern die
    // Einsicht, dass Breite dieses Problem nicht löst.
    const viele = Array.from({ length: 25 }, (_, i) =>
      seg(`2026-01-${String(i + 1).padStart(2, '0')}`, `2026-01-${String(i + 2).padStart(2, '0')}`));
    const g = baueBandGeometrie([spur('tv1', 'tv', viele)], BEZUG, 1000);
    expect(Math.min(...g.spuren[0]!.segmente.map(s => s.breite))).toBeCloseTo(MIN_INTERVALL, 1);
  });

  it('bodenFuer: Anteil der Bahn, an beiden Enden gedeckelt', () => {
    // **Der Boden ist ein Boden, kein Deckel.** Er hebt nur an, was proportional
    // darunter läge; ein kurzer Abschnitt neben einem langen bleibt sonst bei
    // seinem Anteil. Das ist die Eigenschaft, die „Breite = Dauer" rettet.
    expect(bodenFuer(4, 1000)).toBe(56);    // 125 → auf den Deckel
    expect(bodenFuer(10, 1000)).toBe(50);   // im Anteilsbereich
    expect(bodenFuer(26, 1000)).toBe(24);   // 19 → auf das Mindestmaß
    expect(bodenFuer(4, 300)).toBe(37);
    expect(bodenFuer(0, 1000)).toBe(MIN_INTERVALL);
  });

  it('ist monoton — x wächst mit der Zeit', () => {
    const g = baueBandGeometrie([
      spur('tv1', 'tv', [seg('2020-01-01', '2022-01-01'), seg('2022-01-01', '2022-01-05'),
        seg('2022-01-05', BEZUG)]),
    ], BEZUG, 600);
    const links = g.spuren[0]!.segmente.map(s => s.links);
    expect(links).toEqual([...links].sort((a, b) => a - b));
  });
});

describe('Einseitig verankerte Segmente', () => {
  it('bekommen eine angeschnittene Kante, keine Ersatzbreite', () => {
    const g = baueBandGeometrie([
      spur('tv1', 'tv', [seg(null, '2024-06-01'), seg('2024-06-01', BEZUG)]),
    ], BEZUG, 800);
    const [offen, normal] = g.spuren[0]!.segmente;
    expect(offen!.offenLinks).toBe(true);
    expect(offen!.links).toBe(0);              // läuft bis zum Achsenrand
    expect(normal!.offenLinks).toBe(false);
    expect(normal!.offenRechts).toBe(false);
  });

  it('erkennt ein offenes Ende', () => {
    const g = baueBandGeometrie([
      spur('tv1', 'tv', [seg('2024-01-01', '2024-06-01'), seg('2024-06-01', null)]),
    ], BEZUG, 800);
    expect(g.spuren[0]!.segmente[1]!.offenRechts).toBe(true);
  });
});

describe('Bündelung identischer Spuren', () => {
  const gleich = (id: string): VerlaufsSpur =>
    spur(id, 'tv', [seg('2024-01-01', '2024-06-01'), seg('2024-06-01', BEZUG)]);
  const anders = (id: string): VerlaufsSpur =>
    spur(id, 'tv', [seg('2024-01-01', '2024-07-01', 59), seg('2024-07-01', BEZUG, 59)]);

  it('lässt wenige Teilvorhaben einzeln stehen', () => {
    const s = buendle([gleich('a'), gleich('b'), gleich('c')]);
    expect(s).toHaveLength(3);
    expect(s.every(x => x.gleiche.length === 0)).toBe(true);
  });

  it('fasst ab sechs Teilvorhaben zusammen, was denselben Verlauf hat', () => {
    const tvs = [gleich('a'), gleich('b'), gleich('c'), gleich('d'), anders('e'), anders('f')];
    expect(tvs).toHaveLength(BUENDEL_AB);
    const s = buendle(tvs);
    expect(s).toHaveLength(2);
    expect(s.map(x => x.gleiche.length).sort()).toEqual([1, 3]);
  });

  it('bündelt die Verbundspur NIE — sie ist die Bezugsgröße', () => {
    const vb = spur('vb', 'verbund', [seg('2024-01-01', '2024-06-01'), seg('2024-06-01', BEZUG)]);
    const s = buendle([vb, gleich('a'), gleich('b'), gleich('c'), gleich('d'), gleich('e'), gleich('f')]);
    const verbund = s.filter(x => x.spur.art === 'verbund');
    expect(verbund).toHaveLength(1);
    expect(verbund[0]!.gleiche).toHaveLength(0);
    // … obwohl ihr Verlauf mit den TV-Spuren identisch ist.
    expect(spurSignatur(vb)).toBe(spurSignatur(gleich('a')));
  });
});

describe('Spuren ohne datierte Grenzen', () => {
  it('spannen ihr Segment über die volle Breite, statt auf 1 px zu fallen', () => {
    // Der Fall aus Richtlinie 2015: die App kennt den Status, aber keine Regel
    // erklärt einen Wechsel — es gibt genau ein Segment ohne beide Grenzen.
    // Ohne Achsenausdehnung kollabierte es zu einem Strich, und ein Strich ist
    // die schlechteste aller Aussagen.
    const g = baueBandGeometrie([
      spur('vb', 'verbund', [seg(null, null, 99)]),
    ], BEZUG, 500);
    const s = g.spuren[0]!.segmente[0]!;
    expect(s.breite).toBeGreaterThanOrEqual(400);
    expect(s.offenLinks).toBe(true);
    expect(s.offenRechts).toBe(true);
  });
});

describe('Leere Spuren', () => {
  it('tragen keine Segmente und kippen die Achse nicht', () => {
    const leer: VerlaufsSpur = {
      ...spur('tv1', 'tv', []), zustand: 'kein_bearbeitungsstand',
      begruendung: 'kein Bearbeitungsstand',
    };
    const g = baueBandGeometrie([leer], BEZUG, 800);
    expect(g.spuren[0]!.segmente).toHaveLength(0);
    expect(g.von).toBeNull();
    expect(Number.isFinite(g.breite)).toBe(true);
  });
});

describe('Die x-Skala nach außen', () => {
  /** Zwei Segmente, also drei Kanten — die Achse ist stückweise gestaucht. */
  const geo = () => baueBandGeometrie(
    [spur('tv1', 'tv', [seg('2024-01-01', '2024-02-01'), seg('2024-02-01', BEZUG)])],
    BEZUG, 800,
  );

  it('setzt einen Tag genau dorthin, wo der Balken ihn hat', () => {
    const g = geo();
    const kante = g.spuren[0]!.segmente[1]!.links;
    expect(xFuerTag(g.achse, '2024-02-01')).toBeCloseTo(kante, 6);
  });

  it('trifft dieselbe Stelle auch mit voller ISO-Zeitangabe', () => {
    const g = geo();
    expect(xFuerTag(g.achse, '2024-02-01T00:00:00.000Z'))
      .toBeCloseTo(xFuerTag(g.achse, '2024-02-01'), 6);
  });

  it('klemmt außerhalb — und `imFenster` widerspricht dem', () => {
    const g = geo();
    expect(xFuerTag(g.achse, '2000-01-01')).toBe(0);
    expect(xFuerTag(g.achse, '2099-01-01')).toBeCloseTo(g.breite, 6);
    expect(imFenster(g.achse, '2000-01-01')).toBe(false);
    expect(imFenster(g.achse, '2099-01-01')).toBe(false);
    expect(imFenster(g.achse, '2024-02-01')).toBe(true);
  });

  it('zählt die Ränder als drin', () => {
    const g = geo();
    expect(imFenster(g.achse, '2024-01-01')).toBe(true);
    expect(imFenster(g.achse, BEZUG)).toBe(true);
  });
});

describe('dauerText', () => {
  it('wechselt die Einheit mit der Größenordnung', () => {
    expect([0, 12, 30, 45, 200, 400, 2600, 5000].map(dauerText))
      .toEqual(['0 T', '12 T', '30 T', '1 Mon', '7 Mon', '1.1 J', '7.1 J', '14 J']);
  });

  it('sagt „unbekannt" statt null', () => {
    expect(dauerText(null)).toBe('Dauer unbekannt');
  });
});

describe('Die Achse steht über ALLEN Spuren', () => {
  const ueb = (kuerzel: string, datum: string): VerlaufsSpur['uebergaenge'][number] => ({
    kuerzel, datum, feldId: `D_${kuerzel}`, prominenz: 'normal',
    rollen: [], rollenLage: 'neutral', konfidenz: 'kein_kuerzel',
    bezeichnung: null, bezeichnungEindeutig: true,
  });

  const drei = (): VerlaufsSpur[] => [
    spur('vb', 'verbund', [seg('2024-01-01', BEZUG)]),
    spur('tv1', 'tv', [seg('2024-01-01', '2024-06-01'), seg('2024-06-01', BEZUG)]),
    spur('tv2', 'tv', [seg('2024-03-01', BEZUG)]),
  ];

  it('lässt den Maßstab unberührt, wenn nur eine Bahn gezeichnet wird', () => {
    // Die Zusage, an der der geteilte Fokus hängt: „nur TV 1" ist ein Ausschnitt
    // desselben Bildes, nicht ein zweites. Verschöbe sich die Skala, zeigte
    // dieselbe Ansicht denselben Tag an zwei Stellen.
    const alle = baueBandGeometrie(drei(), BEZUG, 800);
    const eine = baueBandGeometrie(drei(), BEZUG, 800, { nurBahnen: new Set(['tv-tv1']) });
    expect(eine.spuren.map(b => b.spur.id)).toEqual(['tv1']);
    expect(eine.breite).toBe(alle.breite);
    expect(xFuerTag(eine.achse, '2024-06-01')).toBe(xFuerTag(alle.achse, '2024-06-01'));
    // ... auch für einen Tag, den NUR eine abgewählte Bahn kennt.
    expect(xFuerTag(eine.achse, '2024-03-01')).toBe(xFuerTag(alle.achse, '2024-03-01'));
  });

  it('zeichnet gar keine Bahn, wenn die Wahl keine trifft', () => {
    const g = baueBandGeometrie(drei(), BEZUG, 800, { nurBahnen: new Set(['tv-gibtesnicht']) });
    expect(g.spuren).toEqual([]);
    expect(Number.isFinite(g.breite)).toBe(true);
  });

  it('deckt den frühesten Termin, auch wenn er vor dem ersten Statuswechsel liegt', () => {
    // `FOY` (Import ZIM-Foyer) steht im Bestand vor `AAE`. Ohne diese Kante
    // fiele seine Marke auf x = 0 und behauptete dort ein Datum.
    const s = spur('tv1', 'tv', [seg('2024-01-01', BEZUG)]);
    const mitTermin: VerlaufsSpur = { ...s, uebergaenge: [ueb('FOY', '2023-11-02')] };
    expect(imFenster(baueBandGeometrie([s], BEZUG, 800).achse, '2023-11-02')).toBe(false);

    const g = baueBandGeometrie([mitTermin], BEZUG, 800);
    expect(imFenster(g.achse, '2023-11-02')).toBe(true);
    // GENAU eine Kante mehr: neunzig Termine als Kanten blähten die Bahn auf.
    expect(g.achse.kanten).toHaveLength(3);
  });

  it('fügt keine Kante hinzu, wenn die Termine im Fenster liegen', () => {
    const s = spur('tv1', 'tv', [seg('2024-01-01', BEZUG)]);
    const drin: VerlaufsSpur = { ...s, uebergaenge: [ueb('AAE', '2024-05-05')] };
    expect(baueBandGeometrie([drin], BEZUG, 800).achse.kanten).toHaveLength(2);
  });
});
