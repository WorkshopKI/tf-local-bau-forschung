/**
 * Die Aggregation des Haltedatum-Bestandslaufs — rein, ohne IDB.
 *
 * Die wichtigste Zusage ist eine **Nicht**-Zusage: die Zustandsmatrix muss
 * diagonal bleiben. `matrixDiagonal` ist deshalb mit einer Gegenprobe geprüft —
 * eine Funktion, die am Bestand immer `true` liefert, ist ohne sie nicht von
 * einer kaputten zu unterscheiden.
 */
import { describe, expect, it } from 'vitest';
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import {
  leereFristBefunde, matrixDiagonal, musterSchluessel, musterSortiert, nimmFristAuf,
} from '../fristErhebung';

const OHNE: FristErgebnis = {
  zustand: 'angehalten', grund: 'Haltedatum unbekannt', haltedatumQuelle: 'unbekannt',
};
const MIT: FristErgebnis = {
  zustand: 'angehalten', bezugsZeitpunkt: '2019-06-02', haltedatumQuelle: 'verlauf_bestaetigt',
};

describe('Musterbildung', () => {
  it('nennt Zustand UND Quelle, vorher wie nachher', () => {
    expect(musterSchluessel(OHNE, MIT))
      .toBe('angehalten|unbekannt → angehalten|verlauf_bestaetigt');
  });

  it('markiert Unveränderte als solche, statt einen Pfeil auf sich selbst zu zeichnen', () => {
    expect(musterSchluessel(MIT, MIT)).toBe('angehalten|verlauf_bestaetigt (unverändert)');
  });

  it('deckelt die Beispiele, statt eine Liste über den ganzen Bestand zu führen', () => {
    const b = leereFristBefunde();
    for (let i = 0; i < 12; i++) nimmFristAuf(b, OHNE, MIT, `VB${i}`, 'ABB');
    const m = musterSortiert(b)[0]!;
    expect(m.anzahl).toBe(12);
    expect(m.beispiele).toHaveLength(5);
    expect(m.kuerzelBeispiel).toBe('ABB');
  });

  it('sortiert nach Gewicht, damit der Bericht von oben abgearbeitet werden kann', () => {
    const b = leereFristBefunde();
    nimmFristAuf(b, MIT, MIT, 'VB-A', null);
    for (let i = 0; i < 4; i++) nimmFristAuf(b, OHNE, MIT, `VB${i}`, 'ABB');
    expect(musterSortiert(b).map(m => m.anzahl)).toEqual([4, 1]);
  });
});

describe('Was gezählt wird', () => {
  it('zählt ein erstmals bestimmtes Haltedatum', () => {
    const b = leereFristBefunde();
    nimmFristAuf(b, OHNE, MIT, 'VB1', 'ABB');
    expect(b.neuDatiert).toBe(1);
    expect(b.umdatiert).toBe(0);
    expect(b.achseVerschoben).toBe(1);
    expect(b.jeQuelle.get('verlauf_bestaetigt')).toBe(1);
  });

  it('zählt eine Umdatierung getrennt — sie darf nicht vorkommen', () => {
    const b = leereFristBefunde();
    const vorher: FristErgebnis = {
      zustand: 'angehalten', bezugsZeitpunkt: '2018-01-01', haltedatumQuelle: 'journal',
    };
    nimmFristAuf(b, vorher, MIT, 'VB1', 'ABB');
    expect(b.umdatiert).toBe(1);
    expect(b.neuDatiert).toBe(0);
  });

  it('zählt nichts, wo sich nichts bewegt', () => {
    const b = leereFristBefunde();
    nimmFristAuf(b, MIT, MIT, 'VB1', 'ABB');
    expect(b.neuDatiert).toBe(0);
    expect(b.achseVerschoben).toBe(0);
    expect(b.vorgaenge).toBe(1);
  });
});

describe('Die Diagonale', () => {
  it('meldet einen additiven Lauf als diagonal', () => {
    const b = leereFristBefunde();
    nimmFristAuf(b, OHNE, MIT, 'VB1', 'ABB');
    expect(matrixDiagonal(b)).toBe(true);
  });

  it('erkennt einen Zustandswechsel (Positivkontrolle)', () => {
    // Kann nach heutiger Engine nicht passieren — genau deshalb muss die
    // Prüfung zeigen, dass sie es sähe.
    const b = leereFristBefunde();
    const gewandert: FristErgebnis = {
      zustand: 'laeuft', bezugsZeitpunkt: '2026-08-07', tageRest: 12, haltedatumQuelle: 'unbekannt',
    };
    nimmFristAuf(b, OHNE, gewandert, 'VB1', null);
    expect(matrixDiagonal(b)).toBe(false);
  });
});
