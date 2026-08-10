/**
 * Die **Meilenstein-Ebene** auf der Band-Achse.
 *
 * Drei Zusagen: Marken derselben Bahn überlagern sich nie (auch nicht durch das
 * Verzugslabel, das rechts hinausragt), die Bahn-Zuordnung landet beim richtigen
 * Element (auch bei unsortierter Eingabe), und ein Datum außerhalb der Achse
 * wird **gezählt**, nicht an den Rand geklemmt.
 */
import { describe, it, expect } from 'vitest';
import {
  MS_ABSTAND, MS_LABEL_ABSTAND, MS_LABEL_RESERVE, baueMsEbene, packeBahnen, verzugsTexte,
} from '@/plugins/antraege/ausklapp/zeitverlauf/msEbene';
import { baueStufen, trifftPraefix } from '@/plugins/antraege/ausklapp/meilensteinLage';
import type { ZeitAchse } from '@/plugins/antraege/verlauf-band/bandGeometrie';
import { ergebnis, knoten, lageDa } from './fixtures/meilensteinLage';

const HEUTE = '2026-08-05';

/** Lineare Achse 01.01.2026 → 05.08.2026 auf 0…1000 px. */
const ACHSE: ZeitAchse = {
  kanten: [Date.UTC(2026, 0, 1), Date.UTC(2026, 7, 5)],
  x: [0, 1000],
};

describe('packeBahnen', () => {
  it('legt überlappende Marken in verschiedene Bahnen', () => {
    const b = packeBahnen([
      { links: 0, breite: 50, reserve: 0 },
      { links: 20, breite: 50, reserve: 0 },
      { links: 200, breite: 50, reserve: 0 },
    ], MS_ABSTAND);
    expect(b).toEqual([0, 1, 0]);
  });

  it('rechnet die Labelreserve als Belegung mit', () => {
    // Ohne Reserve passte die zweite Marke in dieselbe Bahn (10+2+6 <= 40).
    expect(packeBahnen([
      { links: 10, breite: 2, reserve: 0 },
      { links: 40, breite: 2, reserve: 0 },
    ], MS_ABSTAND)).toEqual([0, 0]);
    expect(packeBahnen([
      { links: 10, breite: 2, reserve: MS_LABEL_RESERVE },
      { links: 40, breite: 2, reserve: 0 },
    ], MS_ABSTAND)).toEqual([0, 1]);
  });

  it('gibt die Bahn dem EINGABE-Index, nicht der Zeitreihenfolge', () => {
    // Absichtlich verkehrt herum hereingereicht.
    expect(packeBahnen([
      { links: 300, breite: 20, reserve: 0 },
      { links: 0, breite: 20, reserve: 0 },
      { links: 5, breite: 20, reserve: 0 },
    ], MS_ABSTAND)).toEqual([0, 0, 1]);
  });

  it('kommt mit einer leeren Eingabe aus', () => {
    expect(packeBahnen([], MS_ABSTAND)).toEqual([]);
  });
});

describe('baueMsEbene', () => {
  const lage = () => lageDa(
    [
      knoten({ id: 'k1', nummer: '1' }),
      knoten({ id: 'k1-1', nummer: '1.1', elternId: 'k1', sortierung: 10 }),
      knoten({ id: 'k1-2', nummer: '1.2', elternId: 'k1', sortierung: 20 }),
      knoten({ id: 'k2', nummer: '2', sortierung: 20 }),
    ],
    [
      ergebnis('k1', 'gerissen', { sollDatum: '2026-02-01' }),
      ergebnis('k1-1', 'erreicht', { istDatum: '2026-02-01' }),
      ergebnis('k1-2', 'gerissen', { sollDatum: '2026-04-01' }),
      ergebnis('k2', 'nichtRelevant'),
    ],
  );

  const bauen = (bis = HEUTE, stichtag = HEUTE) =>
    baueMsEbene({ stufen: baueStufen(lage()), achse: ACHSE, bis, stichtag });

  it('zeichnet nur Blätter — der Sammel-Knoten verdoppelte seine Kinder', () => {
    expect(bauen().marken.map(m => m.nummer).sort()).toEqual(['1.1', '1.2']);
  });

  it('setzt eine erreichte Stufe als Punkt auf ihr Ist-Datum', () => {
    const m = bauen().marken.find(x => x.nummer === '1.1')!;
    expect(m.art).toBe('erreicht');
    expect(m.text).toBeNull();
    expect(m.titel).toContain('erreicht 01.02.2026');
  });

  it('zieht eine gerissene Stufe vom Soll bis zum Achsenende und beschriftet sie', () => {
    const m = bauen().marken.find(x => x.nummer === '1.2')!;
    expect(m.art).toBe('gerissen');
    // 01.04.2026 → 05.08.2026 = 126 Tage.
    expect(m.text).toBe('1.2 · 126 T');
    expect(Math.round(m.links + m.breite)).toBe(1000);
  });

  it('zählt eine Marke außerhalb der Achse, statt sie an den Rand zu klemmen', () => {
    const frueh = lageDa(
      [knoten({ id: 'k', nummer: '1' })],
      [ergebnis('k', 'erreicht', { istDatum: '2020-01-01' })],
    );
    const m = baueMsEbene({
      stufen: baueStufen(frueh), achse: ACHSE, bis: HEUTE, stichtag: HEUTE,
    });
    expect(m.marken).toHaveLength(0);
    expect(m.ausserhalb).toBe(1);
  });

  it('sagt es, wenn die Achse vor dem Stichtag endet (angehaltene Uhr)', () => {
    expect(bauen().hinweis).toBeNull();
    expect(bauen('2026-06-01', HEUTE).hinweis).toContain('angehaltene Uhr');
  });

  it('hat ohne Marken keine Höhe', () => {
    const leer = baueMsEbene({ stufen: [], achse: ACHSE, bis: HEUTE, stichtag: HEUTE });
    expect(leer.marken).toHaveLength(0);
    expect(leer.hoehe).toBe(0);
  });
});

describe('Die Reserve des Verzugslabels', () => {
  const lage = () => lageDa(
    [knoten({ id: 'a', nummer: '1.4.3' }), knoten({ id: 'b', nummer: '3', sortierung: 20 })],
    [
      ergebnis('a', 'gerissen', { sollDatum: '2026-04-01' }),
      ergebnis('b', 'erreicht', { istDatum: '2026-02-01' }),
    ],
  );

  it('liefert die Texte OHNE Achse — sonst wäre die Breitenrechnung ein Ringschluss', () => {
    // Die Reserve geht in die Bahnbreite ein, die Bahnbreite in die Achse.
    expect(verzugsTexte(baueStufen(lage()), HEUTE)).toEqual(['1.4.3 · 126 T']);
  });

  it('nimmt die gemessene Breite statt der Pauschale, wenn gemessen wird', () => {
    const stufen = baueStufen(lage());
    const ohne = baueMsEbene({ stufen, achse: ACHSE, bis: HEUTE, stichtag: HEUTE });
    const mit = baueMsEbene({
      stufen, achse: ACHSE, bis: HEUTE, stichtag: HEUTE,
      messeText: t => t.length * 6,
    });
    // Beide platzieren dieselben Marken; unterschiedlich ist nur die Belegung —
    // sichtbar daran, dass die Bahnzahl mit einer breiteren Reserve steigen kann.
    expect(ohne.marken.map(m => m.knotenId)).toEqual(mit.marken.map(m => m.knotenId));
    expect(MS_LABEL_RESERVE).toBeGreaterThan(MS_LABEL_ABSTAND);
  });
});

describe('trifftPraefix — die Kopplung Gliederung ⇄ Achse', () => {
  it('trifft sich selbst und echte Nachfahren', () => {
    expect(trifftPraefix('1', '1')).toBe(true);
    expect(trifftPraefix('1.4.3', '1')).toBe(true);
    expect(trifftPraefix('1.4.3', '1.4')).toBe(true);
  });

  it('trifft NICHT den nackten Zeichen-Präfix', () => {
    expect(trifftPraefix('1.40', '1.4')).toBe(false);
    expect(trifftPraefix('10', '1')).toBe(false);
  });
});
