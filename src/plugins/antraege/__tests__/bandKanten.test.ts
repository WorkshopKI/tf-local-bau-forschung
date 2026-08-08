/**
 * **Ein Tag, eine Kante.**
 *
 * Der Befund, der diese Datei begründet: im Bestand zeichnete die Bahn **51
 * Striche auf 26 Tagen** — bis zu drei exakt übereinander. Sichtbar war der
 * zuletzt gezeichnete, und wenn das ein Symbol war, verdeckte es den Strich
 * darunter und las sich als eigene, unerklärliche Marke.
 *
 * Die Zusagen: kein Tag doppelt, der Strich zeigt die BESTE Belegung des Tages,
 * und verschwiegen wird dabei nichts — jeder Übergang bleibt an seiner Kante.
 */
import { describe, it, expect } from 'vitest';
import type { Konfidenz, VerlaufsSegment, VerlaufsUebergang } from '@/core/status/verlauf';
import type { BandSegment } from '@/plugins/antraege/verlauf-band/bandGeometrie';
import { baueKanten, verteileKuerzel } from '@/plugins/antraege/verlauf-band/bandKanten';

function seg(von: string | null, links: number, roh = 's'): BandSegment {
  const s: VerlaufsSegment = {
    statusRef: { roh, code: 1, kurz: 'S', lang: 'Status', labelHerkunft: 'katalog' },
    vonDatum: von, bisDatum: null, dauerTage: null, dauerUnsicher: true,
  };
  return { segment: s, links, breite: 40, offenLinks: false, offenRechts: false, gestaucht: false };
}

function ueb(kuerzel: string, datum: string, konfidenz: Konfidenz): VerlaufsUebergang {
  return {
    kuerzel, datum, rollen: [], rollenLage: 'neutral', konfidenz,
    bezeichnung: null, bezeichnungEindeutig: true,
  };
}

describe('baueKanten', () => {
  it('bündelt mehrere Übergänge desselben Tages zu EINER Kante', () => {
    const k = baueKanten(
      [seg('2024-01-01', 0), seg('2024-06-01', 200)],
      [
        ueb('AAE', '2024-01-01', 'kein_kuerzel'),
        ueb('XTE', '2024-01-01', 'trigger_bedingt'),
        ueb('ABB', '2024-06-01', 'trigger_bestaetigt'),
      ],
    );
    expect(k).toHaveLength(2);
    expect(k[0]?.uebergaenge).toHaveLength(2);
    expect(k[1]?.uebergaenge).toHaveLength(1);
  });

  it('nimmt die BESTE Konfidenz des Tages für den Strich', () => {
    const k = baueKanten([seg('2024-01-01', 0)], [
      ueb('A', '2024-01-01', 'kein_kuerzel'),
      ueb('B', '2024-01-01', 'trigger_bestaetigt'),
      ueb('C', '2024-01-01', 'zeitliche_naehe'),
    ]);
    expect(k[0]?.konfidenz).toBe('trigger_bestaetigt');
    // ... und listet sie best-belegt zuerst, damit der Tooltip so liest.
    expect(k[0]?.uebergaenge.map(u => u.kuerzel)).toEqual(['B', 'C', 'A']);
  });

  it('verschweigt keinen Übergang des Tages', () => {
    const k = baueKanten([seg('2024-01-01', 0)], [
      ueb('A', '2024-01-01', 'kein_kuerzel'),
      ueb('B', '2024-01-01', 'kein_kuerzel'),
      ueb('C', '2024-01-01', 'kein_kuerzel'),
    ]);
    expect(k).toHaveLength(1);
    expect(k[0]?.uebergaenge.map(u => u.kuerzel).sort()).toEqual(['A', 'B', 'C']);
  });

  it('lässt Übergänge ohne Segmentgrenze am selben Tag fallen', () => {
    // Sie haben keine Stelle auf der Achse — ihr Ort ist die Klartext-Liste.
    const k = baueKanten([seg('2024-01-01', 0)], [
      ueb('A', '2024-01-01', 'trigger_bestaetigt'),
      ueb('B', '2024-03-15', 'trigger_bestaetigt'),
    ]);
    expect(k).toHaveLength(1);
    expect(k[0]?.datum).toBe('2024-01-01');
  });

  it('nimmt die x-Position vom Segment, das an diesem Tag beginnt', () => {
    const k = baueKanten([seg('2024-01-01', 0), seg('2024-06-01', 137)], [
      ueb('A', '2024-06-01', 'trigger_bestaetigt'),
    ]);
    expect(k[0]?.x).toBe(137);
  });

  it('sortiert nach x, nicht nach Fundreihenfolge', () => {
    const k = baueKanten([seg('2024-01-01', 0), seg('2024-06-01', 200), seg('2024-09-01', 400)], [
      ueb('C', '2024-09-01', 'trigger_bestaetigt'),
      ueb('A', '2024-01-01', 'trigger_bestaetigt'),
      ueb('B', '2024-06-01', 'trigger_bestaetigt'),
    ]);
    expect(k.map(x => x.x)).toEqual([0, 200, 400]);
  });

  it('gibt bei Segmenten ohne datierte Grenze gar keine Kante aus', () => {
    // `vonDatum === null` heißt „Anfang unbekannt" — daran hängt kein Kürzel.
    expect(baueKanten([seg(null, 0)], [ueb('A', '2024-01-01', 'trigger_bestaetigt')])).toEqual([]);
  });

  it('führt den Rohstatus des Abschnitts mit, der hier BEGINNT', () => {
    // Der Grenzstreifen trägt dessen Farbe. Der Join gehört hierher, nicht in
    // die zeichnende Datei — dort wäre es eine zweite Zuordnung.
    const k = baueKanten(
      [seg('2024-01-01', 0, 'alt'), seg('2024-06-01', 200, 'neu')],
      [ueb('A', '2024-06-01', 'trigger_bestaetigt')],
    );
    expect(k[0]?.roh).toBe('neu');
  });
});

describe('verteileKuerzel', () => {
  /** 6 px je Zeichen — dieselbe Attrappe wie in `bandBeschriftung.test.ts`. */
  const messe = (s: string): number => s.length * 6;
  const kanten = (...paare: [string, number][]) => baueKanten(
    paare.map(([datum, links]) => seg(datum, links)),
    paare.map(([datum]) => ueb(datum.slice(-2) === '01' ? 'AAE' : 'ABB', datum, 'trigger_bestaetigt')),
  );

  it('zentriert das Kürzel über seiner Kante', () => {
    const m = verteileKuerzel(kanten(['2024-06-05', 200]), { bahnBreite: 400, messeText: messe });
    // 'ABB' = 18 px + 4 Polster = 22 → links = 200 − 11.
    expect(m).toEqual([{ datum: '2024-06-05', links: 189, breite: 22, text: 'ABB' }]);
  });

  it('nennt das best belegte Kürzel und zählt den Rest', () => {
    const k = baueKanten([seg('2024-01-01', 100)], [
      ueb('AAE', '2024-01-01', 'kein_kuerzel'),
      ueb('XPB', '2024-01-01', 'trigger_bestaetigt'),
      ueb('ARZ', '2024-01-01', 'zeitliche_naehe'),
    ]);
    const m = verteileKuerzel(k, { bahnBreite: 400, messeText: messe });
    expect(m[0]?.text).toBe('XPB +2');
  });

  it('lässt weg, was kollidiert — statt zu kürzen', () => {
    // Ein gekürztes Kürzel wäre ein ANDERES Kürzel.
    const m = verteileKuerzel(
      kanten(['2024-01-01', 100], ['2024-06-02', 110]),
      { bahnBreite: 400, messeText: messe },
    );
    expect(m.map(x => x.datum)).toEqual(['2024-01-01']);
  });

  it('setzt beide, sobald der Abstand reicht', () => {
    const m = verteileKuerzel(
      kanten(['2024-01-01', 100], ['2024-06-02', 140]),
      { bahnBreite: 400, messeText: messe },
    );
    expect(m).toHaveLength(2);
    expect(m[0]!.links + m[0]!.breite).toBeLessThanOrEqual(m[1]!.links);
  });

  it('rückt am Rand nach innen, statt halb abgeschnitten zu stehen', () => {
    const m = verteileKuerzel(kanten(['2024-01-01', 0]), { bahnBreite: 400, messeText: messe });
    expect(m[0]?.links).toBe(0);

    const rechts = verteileKuerzel(kanten(['2024-06-02', 400]), { bahnBreite: 400, messeText: messe });
    expect(rechts[0]!.links + rechts[0]!.breite).toBe(400);
  });

  it('schweigt ohne Messung', () => {
    // Ohne Maß ließe sich die Kollision nicht prüfen, und geraten wäre hier
    // schlimmer als still.
    expect(verteileKuerzel(kanten(['2024-01-01', 100]), { bahnBreite: 400, messeText: null }))
      .toEqual([]);
  });

  it('lässt eine Marke weg, die breiter ist als die ganze Bahn', () => {
    expect(verteileKuerzel(kanten(['2024-01-01', 0]), { bahnBreite: 10, messeText: messe }))
      .toEqual([]);
  });
});
