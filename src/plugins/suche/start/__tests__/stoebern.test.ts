/**
 * Die Spalten des Reiters „Stöbern" — was drinsteht und was ein Klick ausführt.
 *
 * Node-Umgebung, kein React. Der Werte-Index ist hier ein Handaufbau: die
 * echte Befüllung läuft im Korpus-Walk und hat ihre eigenen Tests.
 */
import { describe, expect, it } from 'vitest';
import type { WertFeld, WertIndex } from '@/plugins/antraege/services/wert-index';
import {
  baueStoeberSpalten, STOEBER_FELDER, stoeberAnfrage, stoeberKey, stoeberPraefix, WERTE_JE_FELD,
} from '../stoebern';

function index(inhalt: Partial<Record<WertFeld, [string, number][]>>): WertIndex {
  const m = new Map<WertFeld, { wert: string; anzahl: number }[]>();
  for (const [feld, werte] of Object.entries(inhalt) as [WertFeld, [string, number][]][]) {
    m.set(feld, werte.map(([wert, anzahl]) => ({ wert, anzahl })));
  }
  return m;
}

describe('stoeberAnfrage', () => {
  it('schreibt das Präfix, das die App selbst schreibt', () => {
    expect(stoeberAnfrage('standort', 'Dresden')).toBe('ort:Dresden');
    expect(stoeberAnfrage('organisation', 'Fraunhofer')).toBe('ast:Fraunhofer');
    expect(stoeberAnfrage('netzwerk', 'ProAnimalLife')).toBe('nw:ProAnimalLife');
    expect(stoeberAnfrage('deskriptoren', 'Werkstoffe')).toBe('deskriptor:Werkstoffe');
  });

  it('setzt mehrwortige Werte in Anführungszeichen', () => {
    // Ohne sie zerfiele der Wert an den Leerzeichen und suchte etwas anderes,
    // als in der Zeile stand.
    expect(stoeberAnfrage('standort', 'Frankfurt am Main')).toBe('ort:"Frankfurt am Main"');
    expect(stoeberAnfrage('deskriptoren', 'Dienstleistungen (Hardwareberatung)'))
      .toBe('deskriptor:"Dienstleistungen (Hardwareberatung)"');
  });

  it('gibt jedem Feld ein Präfix', () => {
    for (const feld of STOEBER_FELDER) {
      expect(stoeberPraefix(feld).length).toBeGreaterThan(0);
    }
  });
});

describe('stoeberKey', () => {
  it('unterscheidet gleiche Werte in verschiedenen Feldern', () => {
    expect(stoeberKey('standort', 'Jena')).not.toBe(stoeberKey('organisation', 'Jena'));
  });

  it('ist unabhängig von der Schreibweise', () => {
    expect(stoeberKey('standort', 'Dresden')).toBe(stoeberKey('standort', 'DRESDEN'));
  });
});

describe('baueStoeberSpalten', () => {
  it('liefert nichts, solange der Bestand fehlt', () => {
    expect(baueStoeberSpalten(null)).toEqual([]);
  });

  it('nennt die Gesamtzahl der Werte, zeigt aber nur die häufigsten', () => {
    const viele: [string, number][] = Array.from(
      { length: 30 }, (_, i) => [`Ort ${i}`, 100 - i],
    );
    const spalten = baueStoeberSpalten(index({ standort: viele }));
    const ort = spalten.find(s => s.feld === 'standort');
    expect(ort?.gesamt).toBe(30);
    expect(ort?.werte).toHaveLength(WERTE_JE_FELD);
    // Häufigste zuerst — die Reihenfolge des Index bleibt erhalten.
    expect(ort?.werte[0]?.wert).toBe('Ort 0');
  });

  it('lässt Felder ohne einen einzigen Wert weg', () => {
    // Eine Überschrift über einer leeren Spalte behauptet einen Vorrat, den es
    // nicht gibt.
    const spalten = baueStoeberSpalten(index({
      deskriptoren: [['Werkstoffe', 5]],
      netzwerk: [],
    }));
    expect(spalten.map(s => s.feld)).toEqual(['deskriptoren']);
  });

  it('hält die Reihenfolge der Felder ein', () => {
    const spalten = baueStoeberSpalten(index({
      standort: [['Dresden', 9]],
      deskriptoren: [['Werkstoffe', 5]],
      organisation: [['GMBU', 3]],
      netzwerk: [['ProAnimalLife', 2]],
    }));
    expect(spalten.map(s => s.feld)).toEqual(['deskriptoren', 'netzwerk', 'organisation', 'standort']);
  });
});
