/**
 * Die **Beschriftung** des VerlaufsBands — vier Stufen, eine Entscheidung je
 * Segment.
 *
 * Geprüft wird die ENTSCHEIDUNG, nicht die Schrift: die Messfunktion ist eine
 * Attrappe mit runden Zahlen. Ob das echte Modell die Glyphen richtig trifft,
 * beantwortet keine Attrappe — das prüft der Abnahmelauf im Browser gegen das
 * Gerenderte (`scrollWidth` je `[data-band-label]`).
 *
 * Die tragende Zusage dieser Datei: **eine Unter-Beschriftung überlappt keine
 * andere**, und **ohne Messung passiert exakt das, was bis v3.31 passierte**.
 */
import { describe, it, expect } from 'vitest';
import type { VerlaufsSpur } from '@/core/status/verlauf';
import {
  baueBandGeometrie, type BandSegment, type BandSpur,
} from '@/plugins/antraege/verlauf-band/bandGeometrie';
import {
  verteileBeschriftung, type SegmentBeschriftung,
} from '@/plugins/antraege/verlauf-band/bandBeschriftung';

/** 6 px je Zeichen — rund genug, um jede Schwelle im Kopf nachzurechnen. */
const messe = (s: string): number => s.length * 6;

function bandSeg(
  links: number, breite: number, kurz: string, lang: string, gestaucht = false,
): BandSegment {
  return {
    segment: {
      statusRef: { roh: lang, code: null, kurz, lang, labelHerkunft: 'katalog' },
      vonDatum: null, bisDatum: null, dauerTage: null, dauerUnsicher: false,
    },
    links, breite, offenLinks: false, offenRechts: false, gestaucht,
  };
}

function bahn(segmente: BandSegment[]): BandSpur {
  return {
    spur: {
      art: 'tv', id: 'tv1', zustand: 'verlauf', herkunft: 'abgeleitet',
      segmente: segmente.map(s => s.segment), uebergaenge: [], journalAb: null,
      projektform: { art: 'bekannt', form: 'NW' },
    },
    segmente,
    gleiche: [],
  };
}

/** Legende mit Nummern für jeden hier verwendeten Kurznamen. */
const NUMMERN = new Map([['NF', 7], ['AB', 8], ['BR', 3], ['KW', 4], ['NFGESTELLT', 9]]);
const nummerVon = (k: string): number | undefined => NUMMERN.get(k);
const OPT = { messeText: messe, nummerVon };

function lagen(b: SegmentBeschriftung[]): string[] {
  return b.map(s => s.lage);
}

describe('Vier Stufen je Segment', () => {
  it('schreibt den vollen Bezeichner aus, wenn er in den Balken passt', () => {
    // 'NF gestellt' = 11 Zeichen → 66 px; Budget = 90 − 8 − 2 = 80.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 90 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'im-balken', text: 'NF gestellt' });
    expect(r.nummernGenutzt).toBe(false);
  });

  it('nimmt die Kurzform, wenn nur sie passt', () => {
    // Budget = 40 − 8 − 2 = 30. 'NF gestellt' 66 px → nein, 'NF' 12 px → ja.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 40, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 400 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'im-balken', text: 'NF' });
  });

  it('setzt die Beschriftung unter den Balken, wenn auch die Kurzform nicht passt', () => {
    // Budget = 16 − 8 − 2 = 6; 'NF' misst 12 px. Unter dem Balken ist Platz.
    const r = verteileBeschriftung(
      [bahn([bandSeg(24, 16, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 400 },
    );
    // Der volle Bezeichner gewinnt auch hier — er ist der Grund für die Etage.
    expect(r.segmente[0]![0]).toMatchObject({
      lage: 'unter-balken', text: 'NF gestellt', x: 24, rechtsBuendig: false,
    });
    // 66 px Text + 3 px Führungsstrich + 2 px Sicherheit.
    expect(r.segmente[0]![0]!.breite).toBe(71);
  });

  it('fällt auf die Legendennummer zurück, wenn auch darunter kein Platz ist', () => {
    // Die Bahn ist so schmal wie das Segment: unter dem Balken passt nicht
    // einmal die Kurzform (17 px inkl. Führungsstrich) neben 16 px Bahn.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 16, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 16 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'nummer', text: '7' });
    expect(r.nummernGenutzt).toBe(true);
  });

  it('schweigt, wo auch die Nummer nicht passt', () => {
    // Budget = 10 − 8 − 2 = 0; die Ziffer misst 6 px.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 10, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 10 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'keine', text: '' });
    expect(r.nummernGenutzt).toBe(false);
  });
});

describe('Die zweite Etage kollidiert nicht mit sich selbst', () => {
  it('lässt dem zweiten von zwei schmalen Nachbarn keine Unterzeile', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),   // belegt unten 0 … 71
      bandSeg(16, 16, 'AB', 'Ablehnung'),    // will ab x=16 — überlappt
    ])], { ...OPT, bahnBreite: 400 });

    expect(lagen(r.segmente[0]!)).toEqual(['unter-balken', 'nummer']);
    expect(r.nummernGenutzt).toBe(true);
  });

  it('lässt den zweiten schreiben, sobald die Lücke reicht', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),   // belegt unten 0 … 71
      bandSeg(77, 16, 'AB', 'Ablehnung'),    // 77 >= 71 + 6 → passt
    ])], { ...OPT, bahnBreite: 400 });

    expect(lagen(r.segmente[0]!)).toEqual(['unter-balken', 'unter-balken']);
    const [a, b] = r.segmente[0]!;
    expect(a!.x + a!.breite).toBeLessThanOrEqual(b!.x);
  });

  it('weicht auf die Kurzform aus, bevor es über den rechten Bahnrand liefe', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),
      bandSeg(100, 16, 'BR', 'bearbeitungsreif'),  // 16 Zeichen → 96+5 = 101 px
    ])], { ...OPT, bahnBreite: 150 });

    // Der volle Bezeichner liefe ab x=100 bis 201; nach innen gerückt (49) stieße
    // er auf das erste Label (0 … 71). Also die Kurzform an Ort und Stelle —
    // besser als eine Nummer, und ehrlicher als ein verrückter Anker.
    expect(r.segmente[0]!.map(s => [s.lage, s.text])).toEqual([
      ['unter-balken', 'NF gestellt'], ['unter-balken', 'BR'],
    ]);
    for (const s of r.segmente[0]!) {
      if (s.lage === 'unter-balken') expect(s.x + s.breite).toBeLessThanOrEqual(150);
    }
  });

  it('rückt NICHT nach innen, wenn nur der Nachbar im Weg steht', () => {
    // Rechtsbündig hieße hier: das Label des ZWEITEN Abschnitts stünde ganz
    // rechts in der Bahn, weit weg von ihm. Dann lieber die Nummer.
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),        // belegt unten 0 … 71
      bandSeg(16, 16, 'ABLEHNUNGSREIF', 'Ablehnung wurde versandt'),
    ])], { ...OPT, bahnBreite: 400 });

    expect(lagen(r.segmente[0]!)).toEqual(['unter-balken', 'keine']);
  });

  it('rückt das LETZTE Segment nach innen statt es verschwinden zu lassen', () => {
    // Allein in der Bahn: 'Ablehnung' 54 px + 5 = 59, ab x=120 liefe es bis 179.
    const r = verteileBeschriftung(
      [bahn([bandSeg(120, 16, 'AB', 'Ablehnung')])], { ...OPT, bahnBreite: 150 },
    );
    expect(r.segmente[0]![0]).toMatchObject({
      lage: 'unter-balken', text: 'Ablehnung', x: 91, rechtsBuendig: true,
    });
    expect(r.segmente[0]![0]!.x + r.segmente[0]![0]!.breite).toBe(150);
  });
});

describe('Das Bruchzeichen beansprucht seinen Platz', () => {
  it('nimmt dem Text 12 px, nicht aber der Nummer', () => {
    // Budget ohne Stauchung = 40 − 10 = 30 → 'NF' (12 px) passt.
    const ohne = verteileBeschriftung(
      [bahn([bandSeg(0, 40, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 400 },
    );
    expect(ohne.segmente[0]![0]).toMatchObject({ lage: 'im-balken', text: 'NF' });

    // Mit Stauchung = 30 − 12 = 18 → 'NF' passt weiterhin …
    const eng = verteileBeschriftung(
      [bahn([bandSeg(0, 40, 'NF', 'NF gestellt', true)])], { ...OPT, bahnBreite: 400 },
    );
    expect(eng.segmente[0]![0]).toMatchObject({ lage: 'im-balken', text: 'NF' });

    // … aber ein längerer Kurzname (18 px) fällt mit Stauchung heraus.
    const raus = verteileBeschriftung(
      [bahn([bandSeg(0, 34, 'KWX', 'keine weiteren NF', true)])], { ...OPT, bahnBreite: 34 },
    );
    expect(raus.segmente[0]![0]!.lage).not.toBe('im-balken');
  });

  it('lässt einem gestauchten schmalen Abschnitt trotzdem seine Nummer', () => {
    // Textbudget = 20 − 10 − 12 = −2, Nummernbudget = 10. Zöge das Bruchzeichen
    // auch der Ziffer ihren Platz ab, verstummte dieser Abschnitt — heute trägt
    // er seine Nummer, und das darf nicht verloren gehen.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 20, 'NFGESTELLT', 'NF gestellt', true)])], { ...OPT, bahnBreite: 20 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'nummer', text: '9' });
  });
});

describe('Nummern erscheinen nur, wo sie gebraucht werden', () => {
  it('meldet keine Nummern, wenn jedes Segment seinen Namen trägt', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 90, 'NF', 'NF gestellt'),
      bandSeg(90, 90, 'AB', 'Ablehnung'),
    ])], { ...OPT, bahnBreite: 180 });
    expect(r.nummernGenutzt).toBe(false);
    expect(r.unterzeile).toEqual([false]);
  });

  it('verschiebt kein Unter-Label, wenn es gar keine Nummern gibt', () => {
    // Invariante: Nummern besetzen nur Plätze, an denen sonst nichts stünde —
    // sie dürfen die zweite Etage nicht umsortieren.
    const segmente = [
      bandSeg(0, 16, 'NF', 'NF gestellt'),
      bandSeg(16, 16, 'AB', 'Ablehnung'),
      bandSeg(90, 16, 'BR', 'bearbeitungsreif'),
    ];
    const mit = verteileBeschriftung([bahn(segmente)], { ...OPT, bahnBreite: 400 });
    const ohne = verteileBeschriftung(
      [bahn(segmente)], { messeText: messe, nummerVon: () => undefined, bahnBreite: 400 },
    );
    const unter = (r: typeof mit): unknown[] => r.segmente[0]!
      .filter(s => s.lage === 'unter-balken')
      .map(s => ({ x: s.x, breite: s.breite, text: s.text }));
    expect(unter(ohne)).toEqual(unter(mit));
    expect(mit.nummernGenutzt).toBe(true);
    expect(ohne.nummernGenutzt).toBe(false);
  });
});

describe('Ohne Messung bleibt alles wie bis v3.31', () => {
  const ohneMass = { messeText: null, nummerVon, bahnBreite: 400 };

  it('zeigt die Kurzform ab 46 px, die Nummer ab 16, sonst nichts', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 46, 'NF', 'NF gestellt'),
      bandSeg(46, 45, 'AB', 'Ablehnung'),
      bandSeg(91, 16, 'BR', 'bearbeitungsreif'),
      bandSeg(107, 15, 'KW', 'keine weiteren NF'),
    ])], ohneMass);

    expect(r.segmente[0]!.map(s => [s.lage, s.text])).toEqual([
      ['im-balken', 'NF'], ['nummer', '8'], ['nummer', '3'], ['keine', ''],
    ]);
  });

  it('baut keine zweite Etage — ihre Kollision wäre nicht prüfbar', () => {
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 20, 'NF', 'NF gestellt')])], ohneMass,
    );
    expect(r.unterzeile).toEqual([false]);
  });
});

describe('Der Vertrag mit der Geometrie', () => {
  const BEZUG = '2026-08-07';

  function spur(id: string, art: 'tv' | 'verbund', grenzen: [string, string][]): VerlaufsSpur {
    return {
      art, id, zustand: 'verlauf', herkunft: 'abgeleitet',
      segmente: grenzen.map(([von, bis], i) => ({
        statusRef: {
          roh: `s${i}`, code: i, kurz: `S${i}`, lang: `Status ${i}`, labelHerkunft: 'katalog' as const,
        },
        vonDatum: von, bisDatum: bis, dauerTage: 1, dauerUnsicher: false,
      })),
      uebergaenge: [], journalAb: null, projektform: { art: 'bekannt', form: 'NW' },
    };
  }

  it('liefert je Bahn genau so viele Beschriftungen wie Segmente', () => {
    const geo = baueBandGeometrie([
      spur('vb', 'verbund', [['2024-01-01', '2025-01-01'], ['2025-01-01', BEZUG]]),
      spur('tv1', 'tv', [['2024-01-01', '2024-02-01'], ['2024-02-01', '2024-02-02'],
        ['2024-02-02', BEZUG]]),
    ], BEZUG, 900);

    const b = verteileBeschriftung(geo.spuren, { ...OPT, bahnBreite: geo.breite });
    expect(b.segmente).toHaveLength(geo.spuren.length);
    geo.spuren.forEach((s, i) => {
      expect(b.segmente[i]).toHaveLength(s.segmente.length);
    });
    expect(b.unterzeile).toHaveLength(geo.spuren.length);
  });

  it('fasst die Geometrie nicht an', () => {
    // Der Grund, warum Beschriftung und Geometrie zwei Dateien sind: die
    // Geometrie ist im ersten Rahmen fertig, das Textmaß kommt später. Würde die
    // Beschriftung in die Segmente zurückschreiben, hinge die x-Position eines
    // Tages am Zeitpunkt des Schriftladens.
    const geo = baueBandGeometrie([
      spur('vb', 'verbund', [['2024-01-01', '2025-01-01'], ['2025-01-01', BEZUG]]),
      spur('tv1', 'tv', [['2024-01-01', '2024-02-01'], ['2024-02-01', BEZUG]]),
    ], BEZUG, 900);

    const vorher = JSON.stringify(geo);
    verteileBeschriftung(geo.spuren, { ...OPT, bahnBreite: geo.breite });
    expect(JSON.stringify(geo)).toBe(vorher);
  });

  it('meldet die Unterzeile genau dort, wo eine Beschriftung darunter steht', () => {
    const geo = baueBandGeometrie([
      spur('vb', 'verbund', [['2024-01-01', BEZUG]]),
      spur('tv1', 'tv', [['2024-01-01', '2024-02-01'], ['2024-02-01', '2024-02-02'],
        ['2024-02-02', BEZUG]]),
    ], BEZUG, 900);

    const b = verteileBeschriftung(geo.spuren, { ...OPT, bahnBreite: geo.breite });
    b.segmente.forEach((bahnSeg, i) => {
      expect(b.unterzeile[i]).toBe(bahnSeg.some(s => s.lage === 'unter-balken'));
    });
  });
});
