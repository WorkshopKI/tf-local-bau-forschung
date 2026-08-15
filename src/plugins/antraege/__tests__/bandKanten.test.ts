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
import { baueKanten } from '@/plugins/antraege/verlauf-band/bandKanten';

function seg(von: string | null, links: number, roh = 's'): BandSegment {
  const s: VerlaufsSegment = {
    statusRef: { roh, code: 1, kurz: 'S', lang: 'Status', labelHerkunft: 'katalog' },
    vonDatum: von, bisDatum: null, dauerTage: null, dauerUnsicher: true,
  };
  return { segment: s, links, breite: 40, offenLinks: false, offenRechts: false, gestaucht: false };
}

function ueb(kuerzel: string, datum: string, konfidenz: Konfidenz): VerlaufsUebergang {
  return {
    kuerzel, datum, feldId: `D_${kuerzel}`, prominenz: 'normal',
    rollen: [], rollenLage: 'neutral', konfidenz,
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
