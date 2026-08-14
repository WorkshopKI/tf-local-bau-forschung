/**
 * Die Reihenfolge der Ampel-Faelle ist Teil der Aussage: sie entscheidet, was
 * der Nutzer zuerst erfaehrt, wenn mehrere Dinge gleichzeitig gelten. Seit
 * v4.34 lesen zwei Stellen dieselbe Funktion (Suchindex-Seite und
 * Kuration-Uebersicht) — driftete sie, saehe man auf einer Seite etwas anderes
 * als auf der anderen.
 */
import { describe, it, expect } from 'vitest';
import { indexAmpel } from '../indexAmpel';

const HEIL = { chunkCount: 100, modellGewechselt: false, alteWorttrennung: false, neueDokumente: 0 };

describe('indexAmpel', () => {
  it('meldet einen leeren Index als Fehler', () => {
    expect(indexAmpel({ ...HEIL, chunkCount: 0 })).toEqual({
      ton: 'fehler',
      label: 'Kein Index vorhanden — bitte indexieren',
    });
  });

  it('nennt den Modellwechsel vor der Worttrennung', () => {
    const a = indexAmpel({ ...HEIL, modellGewechselt: true, alteWorttrennung: true });
    expect(a.ton).toBe('warnung');
    expect(a.label).toContain('Modell gewechselt');
  });

  it('nennt die Worttrennung vor nicht indexierten Dokumenten', () => {
    const a = indexAmpel({ ...HEIL, alteWorttrennung: true, neueDokumente: 12 });
    expect(a.label).toContain('Worttrennung');
  });

  it('zaehlt nicht indexierte Dokumente', () => {
    expect(indexAmpel({ ...HEIL, neueDokumente: 12 })).toEqual({
      ton: 'warnung',
      label: '12 Dokumente nicht indexiert',
    });
  });

  it('ist gruen, wenn nichts ansteht', () => {
    expect(indexAmpel(HEIL)).toEqual({ ton: 'ok', label: 'Index aktuell' });
  });

  it('schlaegt „kein Index" allem anderen voran', () => {
    // Ohne Index sind Modellwechsel und Nachzuegler bedeutungslos — die
    // Handlungsanweisung ist in jedem Fall „indexieren".
    const a = indexAmpel({ chunkCount: 0, modellGewechselt: true, alteWorttrennung: true, neueDokumente: 9 });
    expect(a.label).toContain('Kein Index');
  });
});
