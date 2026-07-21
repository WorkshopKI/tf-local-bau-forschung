/**
 * Gruppen-Fortschritt der Prüfansicht.
 *
 * Wichtigste Zusage: die Summe der Gruppenzähler entspricht IMMER dem
 * Gesamtfortschritt aus `bewerte()`. Zwei unabhängig gezählte Fortschritte
 * sind der Fehler, an dem der Design-Prototyp scheiterte.
 */
import { describe, expect, it } from 'vitest';
import { baueGruppenFortschritt } from '../ansicht/gruppen';
import type {
  MapBewertungsErgebnis, MapInnoScore, MapItemZustand,
} from '../checkliste/bewertung';
import type { MapChecklistenItem } from '../checkliste/typen';

const item = (id: string, gruppe: string): MapChecklistenItem => ({
  id,
  gruppe,
  kriterium: `Kriterium ${id}`,
  art: 'binaer',
  klasse: 'K',
  herkunft: 'check-kmu',
  aktiv: true,
});

const zustand = (id: string, gruppe: string, anwendbar = true): MapItemZustand => ({
  item: item(id, gruppe),
  anwendbar,
  bewertung: null,
  status: 'offen',
  befunde: [],
  bemerkungFehlt: false,
});

const INNO_LEER: MapInnoScore = {
  punkte: 0, rohSumme: 0, maxPunkte: 9, nullWegenB0: false,
  b0Items: [], vollstaendig: false, vertiefungNoetig: true,
};

const ergebnis = (
  zustaende: MapItemZustand[], offen: string[],
): MapBewertungsErgebnis => {
  const anwendbar = zustaende.filter(z => z.anwendbar).length;
  return {
    zustaende,
    innoScore: INNO_LEER,
    offen,
    nfOffen: [],
    nichtErfuellt: [],
    bemerkungFehlt: [],
    abschlussbereit: offen.length === 0,
    fortschritt: { erledigt: anwendbar - offen.length, gesamt: anwendbar },
  };
};

describe('baueGruppenFortschritt', () => {
  it('zählt je Gruppe erledigt und gesamt', () => {
    const e = ergebnis(
      [zustand('a1', 'Formales'), zustand('a2', 'Formales'), zustand('b1', 'Fachlich')],
      ['a2'],
    );
    expect(baueGruppenFortschritt(e)).toEqual([
      { gruppe: 'Formales', erledigt: 1, gesamt: 2 },
      { gruppe: 'Fachlich', erledigt: 1, gesamt: 1 },
    ]);
  });

  it('behält die Reihenfolge des ersten Auftretens bei', () => {
    const e = ergebnis(
      [zustand('b1', 'Fachlich'), zustand('a1', 'Formales'), zustand('b2', 'Fachlich')],
      [],
    );
    expect(baueGruppenFortschritt(e).map(g => g.gruppe)).toEqual(['Fachlich', 'Formales']);
  });

  it('zählt nicht anwendbare Items in KEINER Spalte mit', () => {
    const e = ergebnis(
      [zustand('a1', 'Formales'), zustand('a2', 'Formales', false)],
      [],
    );
    expect(baueGruppenFortschritt(e)).toEqual([
      { gruppe: 'Formales', erledigt: 1, gesamt: 1 },
    ]);
  });

  it('führt eine Gruppe auch dann, wenn all ihre Items entfallen', () => {
    const e = ergebnis([zustand('a1', 'Bedingt', false)], []);
    expect(baueGruppenFortschritt(e)).toEqual([
      { gruppe: 'Bedingt', erledigt: 0, gesamt: 0 },
    ]);
  });

  it('summiert exakt auf den Gesamtfortschritt von bewerte()', () => {
    const zustaende = [
      zustand('a1', 'Formales'), zustand('a2', 'Formales'), zustand('a3', 'Formales', false),
      zustand('b1', 'Fachlich'), zustand('b2', 'Fachlich'),
      zustand('c1', 'Verbund'),
    ];
    const e = ergebnis(zustaende, ['a2', 'b1']);
    const gruppen = baueGruppenFortschritt(e);

    expect(gruppen.reduce((s, g) => s + g.erledigt, 0)).toBe(e.fortschritt.erledigt);
    expect(gruppen.reduce((s, g) => s + g.gesamt, 0)).toBe(e.fortschritt.gesamt);
  });

  it('liefert bei leerer Checkliste eine leere Liste', () => {
    expect(baueGruppenFortschritt(ergebnis([], []))).toEqual([]);
  });
});
