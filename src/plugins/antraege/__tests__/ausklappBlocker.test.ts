/**
 * **Woran es hängt** — die Auswahl der einen Stufe, an der jemand ansetzt.
 *
 * Zwei Zusagen tragen den Rest: der Blocker ist ein **Blatt** (ein Sammel-Knoten
 * ist nur die Summe seiner Kinder und sagt nicht, wo man anfängt), und die Karte
 * **schweigt nie** — jeder Grund, keinen Blocker zu finden, hat seinen eigenen
 * Satz (Pitfall #44).
 */
import { describe, it, expect } from 'vitest';
import { BLOCKIERT_MAX, findeBlocker } from '@/plugins/antraege/ausklapp/kopfkarte/blocker';
import { ANKER, ergebnis, knoten, lageDa } from './fixtures/meilensteinLage';

const HEUTE = '2026-08-05';

describe('findeBlocker — die Auswahl', () => {
  /** 1 (Sammler) → 1.1 erreicht, 1.2 gerissen (Soll früh); 2 gerissen (Soll spät). */
  const baum = () => lageDa(
    [
      knoten({ id: 'k1', nummer: '1' }),
      knoten({ id: 'k1-1', nummer: '1.1', elternId: 'k1', sortierung: 10 }),
      knoten({ id: 'k1-2', nummer: '1.2', elternId: 'k1', sortierung: 20 }),
      knoten({ id: 'k2', nummer: '2', sortierung: 20 }),
    ],
    [
      ergebnis('k1', 'gerissen', { sollDatum: '2026-02-02' }),
      ergebnis('k1-1', 'erreicht', { istDatum: '2026-01-10' }),
      ergebnis('k1-2', 'gerissen', { sollDatum: '2026-01-12' }),
      ergebnis('k2', 'gerissen', { sollDatum: '2026-03-02' }),
    ],
  );

  it('nimmt das früheste gerissene BLATT, nicht den Sammel-Knoten darüber', () => {
    const b = findeBlocker(baum(), HEUTE);
    expect(b.blocker?.nummer).toBe('1.2');
    expect(b.blocker?.sollDatum).toBe('2026-01-12');
  });

  it('zählt die Verzugstage bis zum Stichtag', () => {
    // 12.01.2026 → 05.08.2026 = 205 Tage.
    expect(findeBlocker(baum(), HEUTE).blocker?.offenTage).toBe(205);
  });

  it('nennt zuerst die gerissenen Eltern (innen → außen), dann die übrigen', () => {
    const b = findeBlocker(baum(), HEUTE);
    expect(b.blockiert.map(x => x.nummer)).toEqual(['1', '2']);
  });

  it('zählt gerissene und relevante BLÄTTER, nicht die Sammel-Stufen', () => {
    const b = findeBlocker(baum(), HEUTE);
    expect(b.gerissen).toBe(2);   // 1.2 und 2
    expect(b.relevant).toBe(3);   // 1.1, 1.2, 2
    expect(b.stufenOben).toBe(2); // 1 und 2
  });

  it('zählt für die Gliederungs-Überschrift ALLE obersten Stufen, auch nicht relevante', () => {
    // Die Gliederung zeigt sie (sonst bekämen die Nummern Lücken); eine
    // Überschrift, die weniger nennt als darunter steht, wäre ein Rechenfehler.
    const lage = lageDa(
      [
        knoten({ id: 'a', nummer: '1' }),
        knoten({ id: 'b', nummer: '2', sortierung: 20 }),
      ],
      [
        ergebnis('a', 'gerissen', { sollDatum: '2026-01-12' }),
        ergebnis('b', 'nichtRelevant'),
      ],
    );
    const b = findeBlocker(lage, HEUTE);
    expect(b.stufenOben).toBe(2);
    expect(b.relevant).toBe(1);
  });

  it('nimmt Nachfahren des Blockers nicht in die Liste der Mitwartenden', () => {
    const lage = lageDa(
      [
        knoten({ id: 'k1', nummer: '1' }),
        knoten({ id: 'k1-1', nummer: '1.1', elternId: 'k1' }),
      ],
      [
        ergebnis('k1', 'gerissen', { sollDatum: '2026-01-12' }),
        ergebnis('k1-1', 'gerissen', { sollDatum: '2026-01-12' }),
      ],
    );
    const b = findeBlocker(lage, HEUTE);
    expect(b.blocker?.nummer).toBe('1.1');
    expect(b.blockiert.map(x => x.nummer)).toEqual(['1']);
  });
});

describe('findeBlocker — Ordnung bei Gleichstand', () => {
  it('sortiert Nummern numerisch: 1.4.3 vor 1.10', () => {
    const lage = lageDa(
      [
        knoten({ id: 'a', nummer: '1.10' }),
        knoten({ id: 'b', nummer: '1.4.3' }),
      ],
      [
        ergebnis('a', 'gerissen', { sollDatum: '2026-01-12' }),
        ergebnis('b', 'gerissen', { sollDatum: '2026-01-12' }),
      ],
    );
    expect(findeBlocker(lage, HEUTE).blocker?.nummer).toBe('1.4.3');
  });

  it('schiebt Stufen ohne Soll-Termin ans Ende', () => {
    const lage = lageDa(
      [knoten({ id: 'a', nummer: '1' }), knoten({ id: 'b', nummer: '2' })],
      [
        ergebnis('a', 'gerissen', { sollDatum: null }),
        ergebnis('b', 'gerissen', { sollDatum: '2026-02-02' }),
      ],
    );
    expect(findeBlocker(lage, HEUTE).blocker?.nummer).toBe('2');
  });
});

describe('findeBlocker — Deckel und Zyklus', () => {
  it('deckelt die Liste und zählt den Rest, statt ihn zu verschweigen', () => {
    const n = BLOCKIERT_MAX + 3;
    const liste = Array.from({ length: n }, (_, i) => knoten({
      id: `k${i}`, nummer: String(i + 1), sortierung: (i + 1) * 10,
    }));
    const erg = liste.map((k, i) => ergebnis(k.id, 'gerissen', {
      sollDatum: `2026-02-${String(i + 1).padStart(2, '0')}`,
    }));
    const b = findeBlocker(lageDa(liste, erg), HEUTE);
    expect(b.blockiert).toHaveLength(BLOCKIERT_MAX);
    expect(b.weitere).toBe(n - 1 - BLOCKIERT_MAX);
  });

  it('terminiert bei einem Eltern-Zyklus aus fehlerhaftem Import', () => {
    const lage = lageDa(
      [
        knoten({ id: 'a', nummer: '1', elternId: 'b' }),
        knoten({ id: 'b', nummer: '2', elternId: 'a' }),
        knoten({ id: 'c', nummer: '3' }),
      ],
      [
        ergebnis('a', 'gerissen', { sollDatum: '2026-02-02' }),
        ergebnis('b', 'gerissen', { sollDatum: '2026-02-03' }),
        ergebnis('c', 'gerissen', { sollDatum: '2026-01-12' }),
      ],
    );
    expect(findeBlocker(lage, HEUTE).blocker?.nummer).toBe('3');
  });
});

describe('findeBlocker — jeder Grund bekommt seinen Satz', () => {
  it.each([
    ['flagAus', 'nicht enthalten'],
    ['ohneVerbund', 'Kein Verbund'],
    ['laedt', 'geladen'],
    ['ohnePlan', 'Kein freigegebener'],
  ] as const)('%s sagt warum', (art, fragment) => {
    const b = findeBlocker({ art }, HEUTE);
    expect(b.blocker).toBeNull();
    expect(b.satz).toContain(fragment);
  });

  it('nennt einen Plan ohne relevante Stufen beim Namen', () => {
    const lage = lageDa(
      [knoten({ id: 'a', nummer: '1' })],
      [ergebnis('a', 'nichtRelevant')],
    );
    expect(findeBlocker(lage, HEUTE).satz).toContain('kein Meilenstein hinterlegt');
  });

  it('nennt das fehlende Antragsdatum, statt „keine gerissene Stufe" zu melden', () => {
    const lage = lageDa(
      [knoten({ id: 'a', nummer: '1' })],
      [ergebnis('a', 'offen', { sollDatum: null })],
      { antragsdatum: null },
    );
    expect(findeBlocker(lage, HEUTE).satz).toContain('keinen Soll-Termin');
  });

  it('unterscheidet „alles erreicht" von „nichts gerissen"', () => {
    const alle = lageDa(
      [knoten({ id: 'a', nummer: '1' })],
      [ergebnis('a', 'erreicht', { istDatum: ANKER })],
    );
    expect(findeBlocker(alle, HEUTE).satz).toBe('Alle Stufen erreicht.');

    const offen = lageDa(
      [knoten({ id: 'a', nummer: '1' })],
      [ergebnis('a', 'offen', { sollDatum: '2026-12-01' })],
    );
    expect(findeBlocker(offen, HEUTE).satz).toContain('Keine gerissene Stufe');
  });

  it('sagt auch bei einem Treffer, worauf sich die Zahlen beziehen', () => {
    const lage = lageDa(
      [knoten({ id: 'a', nummer: '1' })],
      [ergebnis('a', 'gerissen', { sollDatum: '2026-01-12' })],
    );
    expect(findeBlocker(lage, HEUTE).satz).toContain('1 von 1');
  });
});
