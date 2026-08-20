/**
 * Der Text-Hash (v4.127) — aus welchem TEXT ein Vektor stammt.
 *
 * Der eigentliche Fall steht in `waehleZuEmbedden`: ein Antrag, der seinen
 * Vektor bekam, bevor seine Kurzbeschreibung im Wochen-Export stand, hat einen
 * Schluessel — und war damit fuer jeden inkrementellen Lauf erledigt.
 */
import { describe, it, expect } from 'vitest';
import { hashEmbeddingText, waehleZuEmbedden } from '../texthashes';

describe('hashEmbeddingText', () => {
  it('gleicher Text → gleicher Hash, anderer Text → anderer', () => {
    expect(hashEmbeddingText('Kadaversuche aus der Luft'))
      .toBe(hashEmbeddingText('Kadaversuche aus der Luft'));
    expect(hashEmbeddingText('Kadaversuche aus der Luft'))
      .not.toBe(hashEmbeddingText('Kadaversuche aus der Luft.'));
  });

  /** Der reale Uebergang: erst nur der Titel, dann Titel + Kurzbeschreibung. */
  it('meldet den Zuwachs einer Kurzbeschreibung', () => {
    const nurTitel = 'Drohnengestützte Kadaversuche';
    expect(hashEmbeddingText(nurTitel))
      .not.toBe(hashEmbeddingText(`${nurTitel} \n Das Vorhaben entwickelt ein Verfahren …`));
  });

  it('leerer Text hat einen stabilen Hash und kollidiert nicht mit Inhalt', () => {
    expect(hashEmbeddingText('')).toBe(hashEmbeddingText(''));
    expect(hashEmbeddingText('')).not.toBe(hashEmbeddingText(' '));
  });
});

describe('waehleZuEmbedden', () => {
  const lage = (p: {
    aktenzeichen: string[];
    frisch: Record<string, string>;
    vorhanden: string[];
    gemerkt: Record<string, string>;
  }) => waehleZuEmbedden({
    aktenzeichen: p.aktenzeichen,
    frisch: new Map(Object.entries(p.frisch)),
    vorhanden: new Set(p.vorhanden),
    gemerkt: new Map(Object.entries(p.gemerkt)),
  });

  it('ohne Vektor → dran (der bisherige, einzige Fall)', () => {
    expect(lage({
      aktenzeichen: ['A', 'B'], frisch: { A: 'h1', B: 'h2' },
      vorhanden: ['A'], gemerkt: { A: 'h1' },
    })).toEqual(['B']);
  });

  /**
   * Der Fall, um den es geht: A hat einen Vektor, aber sein Text hat sich
   * geaendert (die Kurzbeschreibung kam mit dem Wochen-Export dazu). Vor v4.127
   * blieb A liegen.
   */
  it('Vektor da, Text geaendert → dran', () => {
    expect(lage({
      aktenzeichen: ['A'], frisch: { A: 'neu' },
      vorhanden: ['A'], gemerkt: { A: 'alt' },
    })).toEqual(['A']);
  });

  it('Vektor da, Text unveraendert → nicht dran', () => {
    expect(lage({
      aktenzeichen: ['A'], frisch: { A: 'h' },
      vorhanden: ['A'], gemerkt: { A: 'h' },
    })).toEqual([]);
  });

  /**
   * Die Stelle, an der man sich vertut: „unbekannt" als „dran" zu lesen machte
   * die erste Aktualisierung nach dem Update zum Vollbau — ausgeloest von einem
   * Update, nicht von neuen Daten.
   */
  it('Vektor da, Hash UNBEKANNT → nicht dran (kein Vollbau durch das Update)', () => {
    expect(lage({
      aktenzeichen: ['A', 'B', 'C'], frisch: { A: 'x', B: 'y', C: 'z' },
      vorhanden: ['A', 'B', 'C'], gemerkt: {},
    })).toEqual([]);
  });

  it('mischt die Faelle in der Reihenfolge des Bestands', () => {
    expect(lage({
      aktenzeichen: ['A', 'B', 'C', 'D'],
      frisch: { A: 'a', B: 'neu', C: 'c', D: 'd' },
      vorhanden: ['A', 'B', 'C'],
      gemerkt: { A: 'a', B: 'alt' },
    })).toEqual(['B', 'D']);
  });

  it('leerer Bestand → leere Liste, kein Wurf', () => {
    expect(lage({ aktenzeichen: [], frisch: {}, vorhanden: [], gemerkt: {} })).toEqual([]);
  });
});
