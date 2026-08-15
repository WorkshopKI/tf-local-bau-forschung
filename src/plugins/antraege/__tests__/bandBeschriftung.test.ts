/**
 * Die **Beschriftung** des VerlaufsBands — was im Balken steht, was darunter.
 *
 * Geprüft wird die ENTSCHEIDUNG, nicht die Schrift: die Messfunktion ist eine
 * Attrappe mit runden Zahlen. Ob das echte Modell die Glyphen richtig trifft,
 * beantwortet keine Attrappe — das prüft der Abnahmelauf im Browser gegen das
 * Gerenderte (`scrollWidth` je `[data-band-label]`).
 *
 * Die tragenden Zusagen dieser Datei: **eine Unter-Beschriftung überlappt keine
 * andere**, **eine Dauer verdrängt nie einen Namen**, und **ohne Messung
 * passiert exakt das, was bis v3.31 passierte**.
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
  dauerTage: number | null = null, dauerUnsicher = false,
): BandSegment {
  return {
    segment: {
      statusRef: { roh: lang, code: null, kurz, lang, labelHerkunft: 'katalog' },
      vonDatum: null, bisDatum: null, dauerTage, dauerUnsicher,
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
/**
 * Die Achse zählt hier nicht: die Segmente dieser Datei tragen keine Daten, also
 * gibt es weder Termine noch Lücken zu setzen. Sie steht trotzdem im Satz, weil
 * sie zur Signatur gehört — die Zusagen dieser Datei betreffen die Etage, nicht
 * die Zeit.
 */
const OHNE_ZEIT = { kanten: [], x: [] };
const OPT = { messeText: messe, nummerVon, achse: OHNE_ZEIT };

/**
 * Wo der Text eines Segments gelandet ist — eine Zeichenkette je Segment, damit
 * die Erwartungen lesbar bleiben. `im-balken+unten` heißt: Name oben, Dauer
 * darunter.
 */
function ort(s: SegmentBeschriftung): string {
  if (s.unten === null) return s.lage;
  return s.lage === 'keine' ? 'unten' : `${s.lage}+unten`;
}

function orte(b: SegmentBeschriftung[]): string[] {
  return b.map(ort);
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
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'keine', text: '' });
    expect(r.segmente[0]![0]!.unten).toEqual({
      // 66 px Text + 3 px Führungsstrich + 2 px Sicherheit.
      text: 'NF gestellt', x: 24, breite: 71, rechtsBuendig: false, art: 'name',
    });
  });

  it('fällt auf die Legendennummer zurück, wenn auch darunter kein Platz ist', () => {
    // Die Bahn ist so schmal wie das Segment: unter dem Balken passt nicht
    // einmal die Kurzform (17 px inkl. Führungsstrich) neben 16 px Bahn.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 16, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 16 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'nummer', text: '7', unten: null });
    expect(r.nummernGenutzt).toBe(true);
  });

  it('schweigt, wo auch die Nummer nicht passt', () => {
    // Budget = 10 − 8 − 2 = 0; die Ziffer misst 6 px.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 10, 'NF', 'NF gestellt')])], { ...OPT, bahnBreite: 10 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'keine', text: '', unten: null });
    expect(r.nummernGenutzt).toBe(false);
  });
});

describe('Die zweite Etage kollidiert nicht mit sich selbst', () => {
  it('lässt dem zweiten von zwei schmalen Nachbarn keine Unterzeile', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),   // belegt unten 0 … 71
      bandSeg(16, 16, 'AB', 'Ablehnung'),    // will ab x=16 — überlappt
    ])], { ...OPT, bahnBreite: 400 });

    expect(orte(r.segmente[0]!)).toEqual(['unten', 'nummer']);
    expect(r.nummernGenutzt).toBe(true);
  });

  it('lässt den zweiten schreiben, sobald die Lücke reicht', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),   // belegt unten 0 … 71
      bandSeg(77, 16, 'AB', 'Ablehnung'),    // 77 >= 71 + 6 → passt
    ])], { ...OPT, bahnBreite: 400 });

    expect(orte(r.segmente[0]!)).toEqual(['unten', 'unten']);
    const [a, b] = r.segmente[0]!;
    expect(a!.unten!.x + a!.unten!.breite).toBeLessThanOrEqual(b!.unten!.x);
  });

  it('weicht auf die Kurzform aus, bevor es über den rechten Bahnrand liefe', () => {
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),
      bandSeg(100, 16, 'BR', 'bearbeitungsreif'),  // 16 Zeichen → 96+5 = 101 px
    ])], { ...OPT, bahnBreite: 150 });

    // Der volle Bezeichner liefe ab x=100 bis 201; nach innen gerückt (49) stieße
    // er auf das erste Label (0 … 71). Also die Kurzform an Ort und Stelle —
    // besser als eine Nummer, und ehrlicher als ein verrückter Anker.
    expect(r.segmente[0]!.map(s => s.unten?.text)).toEqual(['NF gestellt', 'BR']);
    for (const s of r.segmente[0]!) {
      if (s.unten !== null) expect(s.unten.x + s.unten.breite).toBeLessThanOrEqual(150);
    }
  });

  it('rückt NICHT nach innen, wenn nur der Nachbar im Weg steht', () => {
    // Rechtsbündig hieße hier: das Label des ZWEITEN Abschnitts stünde ganz
    // rechts in der Bahn, weit weg von ihm. Dann lieber die Nummer.
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'NF', 'NF gestellt'),        // belegt unten 0 … 71
      bandSeg(16, 16, 'ABLEHNUNGSREIF', 'Ablehnung wurde versandt'),
    ])], { ...OPT, bahnBreite: 400 });

    expect(orte(r.segmente[0]!)).toEqual(['unten', 'keine']);
  });

  it('rückt das LETZTE Segment nach innen statt es verschwinden zu lassen', () => {
    // Allein in der Bahn: 'Ablehnung' 54 px + 5 = 59, ab x=120 liefe es bis 179.
    const r = verteileBeschriftung(
      [bahn([bandSeg(120, 16, 'AB', 'Ablehnung')])], { ...OPT, bahnBreite: 150 },
    );
    expect(r.segmente[0]![0]!.unten).toEqual({
      text: 'Ablehnung', x: 91, breite: 59, rechtsBuendig: true, art: 'name',
    });
  });
});

describe('Die Dauer steht in derselben Etage', () => {
  it('setzt sie unter den Balken, wenn der Name darin Platz hat', () => {
    // 'NF gestellt' passt in 90 px; die Etage darunter ist damit frei.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt', false, 28)])], { ...OPT, bahnBreite: 400 },
    );
    expect(r.segmente[0]![0]).toMatchObject({ lage: 'im-balken', text: 'NF gestellt' });
    // '28 T' = 4 Zeichen → 24 px + 3 + 2.
    expect(r.segmente[0]![0]!.unten).toEqual({
      text: '28 T', x: 0, breite: 29, rechtsBuendig: false, art: 'dauer',
    });
  });

  it('hängt sie an den Namen, wenn der schon unter dem Balken steht', () => {
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 16, 'NF', 'NF gestellt', false, 28)])], { ...OPT, bahnBreite: 400 },
    );
    expect(r.segmente[0]![0]!.unten?.text).toBe('NF gestellt · 28 T');
  });

  it('lässt den Namen vor, wenn beides zusammen nicht mehr passt', () => {
    // 'NF gestellt · 28 T' = 18 Zeichen → 108+5 = 113 px, ab x=300 zu viel für
    // eine 400er Bahn. 'NF gestellt' allein (71 px) passt. Der Abschnitt ist
    // bewusst NICHT der letzte — sonst dürfte er nach rechts ausweichen, und
    // die volle Zeichenkette bekäme doch noch ihren Platz.
    const r = verteileBeschriftung([bahn([
      bandSeg(300, 16, 'NF', 'NF gestellt', false, 28),
      bandSeg(316, 84, 'AB', 'Ablehnung'),
    ])], { ...OPT, bahnBreite: 400 });
    expect(r.segmente[0]![0]!.unten?.text).toBe('NF gestellt');
  });

  it('schweigt bei unsicherer Dauer — „1 T" wäre eine Behauptung', () => {
    const unsicher = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt', false, 1, true)])],
      { ...OPT, bahnBreite: 400 },
    );
    expect(unsicher.segmente[0]![0]!.unten).toBeNull();
    expect(unsicher.unterzeile).toEqual([false]);

    // Gegenprobe: ohne das Kennzeichen steht dieselbe Zahl da.
    const sicher = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt', false, 1, false)])],
      { ...OPT, bahnBreite: 400 },
    );
    expect(sicher.segmente[0]![0]!.unten?.text).toBe('1 T');
  });

  it('verdrängt nie einen Namen — die Namen werden ZUERST gesetzt', () => {
    // Der schmale Abschnitt links braucht die Etage für seinen Namen
    // (0 … 101); die Dauer des breiten Nachbarn wollte ab x=16 dorthin.
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'BR', 'bearbeitungsreif'),
      bandSeg(16, 384, 'AB', 'Ablehnung', false, 400),
    ])], { ...OPT, bahnBreite: 400 });

    expect(orte(r.segmente[0]!)).toEqual(['unten', 'im-balken']);
    expect(r.segmente[0]![0]!.unten?.text).toBe('bearbeitungsreif');
    expect(r.segmente[0]![1]!.unten).toBeNull();
  });

  it('setzt dieselbe Dauer, sobald der Name sie nicht mehr blockiert', () => {
    // Gegenprobe zum vorigen Fall bei GLEICHER Geometrie: nur der Name des
    // ersten Abschnitts ist kurz genug für seinen Balken (6 px Budget), also
    // belegt er die Etage nicht.
    const r = verteileBeschriftung([bahn([
      bandSeg(0, 16, 'B', 'B'),
      bandSeg(16, 384, 'AB', 'Ablehnung', false, 400),
    ])], { ...OPT, bahnBreite: 400 });

    expect(r.segmente[0]![1]!.unten?.text).toBe('1.1 J');
  });
});

describe('Die Endmarke am Achsenende', () => {
  const marke = (bahnIndex: number): string | null => (bahnIndex === 0 ? 'hängt fest' : null);

  it('sitzt rechtsbündig am Bahnende', () => {
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt')])],
      { ...OPT, bahnBreite: 400, endMarke: marke },
    );
    // 'hängt fest' = 10 Zeichen → 60 px + 3 + 2 = 65.
    expect(r.endMarken[0]).toEqual({
      text: 'hängt fest', x: 335, breite: 65, rechtsBuendig: true, art: 'warnung',
    });
    expect(r.unterzeile[0]).toBe(true);
  });

  it('bekommt nur die benannte Bahn eine', () => {
    const r = verteileBeschriftung([
      bahn([bandSeg(0, 90, 'NF', 'NF gestellt')]),
      bahn([bandSeg(0, 90, 'AB', 'Ablehnung')]),
    ], { ...OPT, bahnBreite: 400, endMarke: marke });

    expect(r.endMarken[0]).not.toBeNull();
    expect(r.endMarken[1]).toBeNull();
  });

  it('weicht KEINEM Namen — sie wird zuerst gesetzt', () => {
    // Der Name des letzten Abschnitts wollte rechtsbündig genau dorthin
    // (siehe „rückt das LETZTE Segment nach innen"): jetzt ist der Platz weg,
    // und er muss auf die Kurzform bzw. die Nummer ausweichen.
    const ohne = verteileBeschriftung(
      [bahn([bandSeg(120, 16, 'AB', 'Ablehnung')])], { ...OPT, bahnBreite: 150 },
    );
    expect(ohne.segmente[0]![0]!.unten?.text).toBe('Ablehnung');

    const mit = verteileBeschriftung(
      [bahn([bandSeg(120, 16, 'AB', 'Ablehnung')])],
      { ...OPT, bahnBreite: 150, endMarke: marke },
    );
    expect(mit.endMarken[0]!.text).toBe('hängt fest');
    expect(mit.segmente[0]![0]).toMatchObject({ lage: 'nummer', text: '8', unten: null });
  });

  it('entfällt, wenn sie nicht einmal allein in die Bahn passt', () => {
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 40, 'NF', 'NF gestellt')])],
      { ...OPT, bahnBreite: 40, endMarke: marke },
    );
    expect(r.endMarken[0]).toBeNull();
  });

  it('erscheint ohne Messung nicht — dann gibt es die Etage gar nicht', () => {
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt')])],
      { messeText: null, nummerVon, achse: OHNE_ZEIT, bahnBreite: 400, endMarke: marke },
    );
    expect(r.endMarken[0]).toBeNull();
    expect(r.unterzeile).toEqual([false]);
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
      [bahn(segmente)], { messeText: messe, nummerVon: () => undefined, achse: OHNE_ZEIT, bahnBreite: 400 },
    );
    const unter = (r: typeof mit): unknown[] => r.segmente[0]!
      .map(s => s.unten).filter(u => u !== null);
    expect(unter(ohne)).toEqual(unter(mit));
    expect(mit.nummernGenutzt).toBe(true);
    expect(ohne.nummernGenutzt).toBe(false);
  });
});

describe('Ohne Messung bleibt alles wie bis v3.31', () => {
  const ohneMass = { messeText: null, nummerVon, achse: OHNE_ZEIT, bahnBreite: 400 };

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

  it('baut keine zweite Etage — auch nicht für eine Dauer', () => {
    // Ohne Maß ließe sich keine Kollision prüfen. Die Dauer ist die Zugabe, die
    // als erste entfällt; der Rückfall bleibt Stück für Stück der von v3.31.
    const r = verteileBeschriftung(
      [bahn([bandSeg(0, 90, 'NF', 'NF gestellt', false, 28)])], ohneMass,
    );
    expect(r.unterzeile).toEqual([false]);
    expect(r.segmente[0]![0]!.unten).toBeNull();
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
      expect(b.unterzeile[i]).toBe(bahnSeg.some(s => s.unten !== null));
    });
  });
});

describe('Was an keinem Segment hängt: Lücken und Termine', () => {
  const tagMs = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();
  /** Feste Anker, damit die x-Werte im Kopf nachrechenbar bleiben. */
  const ACHSE = {
    kanten: ['2024-01-01', '2024-04-01', '2024-06-01', '2024-12-31'].map(tagMs),
    x: [0, 100, 140, 400],
  };

  const ueb = (
    kuerzel: string, datum: string, bezeichnung: string, setzt = false,
  ): VerlaufsSpur['uebergaenge'][number] => ({
    kuerzel, datum, feldId: `D_${kuerzel}`, prominenz: 'normal',
    rollen: [], rollenLage: 'neutral',
    konfidenz: setzt ? 'trigger_bestaetigt' : 'kein_kuerzel',
    bezeichnung, bezeichnungEindeutig: true,
    ...(setzt
      ? { setztStatus: { roh: 'x', code: 31, kurz: 'X', lang: 'x', labelHerkunft: 'katalog' as const } }
      : {}),
  });

  /** Eine Bahn, deren einziges Segment breit genug ist, um seinen Namen selbst
   *  zu tragen — so konkurriert es nicht um die Etage. */
  const mitTerminen = (uebergaenge: VerlaufsSpur['uebergaenge']): BandSpur => {
    const b = bahn([bandSeg(0, 400, 'NF', 'NF')]);
    return { ...b, spur: { ...b.spur, uebergaenge } };
  };

  const setz = { ...OPT, achse: ACHSE, bahnBreite: 400 };

  it('verbindet Termine desselben Tages zu EINEM Eintrag', () => {
    // Sie sitzen an derselben x-Position und verdeckten einander sonst.
    const r = verteileBeschriftung([mitTerminen([
      ueb('FOY', '2024-04-01', 'Import ZIM-Foyer'),
      ueb('C16', '2024-04-01', 'in C16 eingestellt'),
    ])], setz);
    expect(r.frei[0]).toHaveLength(1);
    expect(r.frei[0]![0]).toMatchObject({
      text: 'Import ZIM-Foyer · in C16 eingestellt', x: 100, art: 'termin',
    });
  });

  it('schreibt NICHT aus, was der Balken schon sagt', () => {
    // Ein Termin, der einen Statuswechsel auslöst, steht als Abschnitt da.
    const r = verteileBeschriftung([mitTerminen([
      ueb('AAE', '2024-04-01', 'Antragseingang', true),
    ])], setz);
    expect(r.frei[0]).toEqual([]);
  });

  it('gibt der Lücke den Platz vor dem Termin', () => {
    // Rangfolge: eine fehlende Seite ist eine Aufgabe, ein Termin eine Auskunft.
    const r = verteileBeschriftung([mitTerminen([
      ueb('FOY', '2024-04-01', 'Import ZIM-Foyer'),
    ])], {
      ...setz,
      luecken: () => [{ seit: '2024-04-01', text: 'Brief NF (TB) fehlt' }],
    });
    expect(r.frei[0]!.map(f => f.art)).toEqual(['luecke']);
    expect(r.frei[0]![0]!.text).toBe('Brief NF (TB) fehlt');
  });

  it('verbindet mehrere Lücken desselben Tages', () => {
    const r = verteileBeschriftung([mitTerminen([])], {
      ...setz,
      luecken: () => [
        { seit: '2024-04-01', text: 'A fehlt' },
        { seit: '2024-04-01', text: 'B fehlt' },
      ],
    });
    expect(r.frei[0]![0]!.text).toBe('A fehlt · B fehlt');
  });

  it('setzt den fokussierten Termin, auch wenn ein früherer den Platz nähme', () => {
    const uebergaenge = [
      ueb('FOY', '2024-04-01', 'Import ZIM-Foyer'),
      ueb('JUR', '2024-06-01', 'jur. Prüfung'),
    ];
    // Ohne Fokus gewinnt der frühere — bei knappem Platz zählt die Chronologie.
    const ohne = verteileBeschriftung([mitTerminen(uebergaenge)], setz);
    expect(ohne.frei[0]!.map(f => f.text)).toEqual(['Import ZIM-Foyer']);

    // Mit Fokus gewinnt der gefragte: er darf nicht der sein, der entfällt.
    const mit = verteileBeschriftung([mitTerminen(uebergaenge)], { ...setz, fokus: 'D_JUR' });
    expect(mit.frei[0]!.map(f => f.text)).toEqual(['jur. Prüfung']);
  });

  it('lässt einen Termin außerhalb der Achse weg', () => {
    const r = verteileBeschriftung([mitTerminen([
      ueb('SPT', '2025-06-01', 'nach dem Stichtag'),
    ])], setz);
    expect(r.frei[0]).toEqual([]);
  });
});
