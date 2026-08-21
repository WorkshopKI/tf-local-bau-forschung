/**
 * Der Block „Alle Felder" im Reiter „Suchsprache".
 *
 * Zwei Zusagen hält dieser Guard. Erstens **Vollständigkeit**: der Block heißt
 * „Alle Felder" und muss das auch sein — ein vierzehntes Feld ohne Beispielwert
 * fiele in `FELD_ZEILEN` still heraus (`flatMap`), und die Überschrift löge.
 * Zweitens **Ausführbarkeit**: jede Zeile startet eine echte Suche. Ein
 * vertipptes Präfix liefe als gewöhnlicher Freitext durch, ohne Fehler und ohne
 * Treffer — sichtbar erst dem, der die Zeile anklickt.
 */
import { describe, it, expect } from 'vitest';
import {
  FELD_PRAEFIX, FELD_SPALTE, zerlegeFeldAnfrage,
} from '@/core/services/search/feldpraefix';
import { TREFFERFELD_LABEL } from '@/core/services/search/trefferstelle';
import { FELD_ZEILEN } from '../feldliste';
import { SUCHARTEN, SUCHSPRACHE_ZEILEN } from '../suchsprache';

describe('FELD_ZEILEN — der Block hält, was seine Überschrift sagt', () => {
  it('führt jedes Feld mit Präfix genau einmal', () => {
    const erwartet = Object.keys(FELD_PRAEFIX).sort();
    expect(FELD_ZEILEN.map(f => f.feld).sort()).toEqual(erwartet);
  });

  it('jedes Beispiel ist EIN Suchteil und trifft sein eigenes Feld', () => {
    for (const zeile of FELD_ZEILEN) {
      const teile = zerlegeFeldAnfrage(zeile.beispiel);
      expect(teile).toHaveLength(1);
      expect(teile[0]?.feld).toBe(zeile.feld);
      // Der Wert darf nicht leer sein — `ast:` allein wirft den Teil weg und
      // suchte damit den ganzen Bestand.
      expect(teile[0]?.wert.length).toBeGreaterThan(0);
    }
  });

  it('nimmt Präfix, Bedeutung und Spaltencode aus der Quelle, nicht aus einem Literal', () => {
    for (const zeile of FELD_ZEILEN) {
      expect(zeile.praefix).toBe(FELD_PRAEFIX[zeile.feld]);
      expect(zeile.label).toBe(TREFFERFELD_LABEL[zeile.feld]);
      expect(zeile.spalte).toBe(FELD_SPALTE[zeile.feld]);
    }
  });

  it('lässt den Spaltencode weg, wo es keine EINE Spalte gibt', () => {
    // Deskriptoren und Web-Adresse werden aus mehreren Spalten zusammengezogen.
    const ohne = FELD_ZEILEN.filter(f => f.spalte === undefined).map(f => f.feld);
    expect(ohne.sort()).toEqual(['deskriptoren', 'domain']);
  });
});

describe('SUCHSPRACHE_ZEILEN — die Zahl am Reiter ist eine Zusage', () => {
  it('zählt beide Teile des Reiters', () => {
    expect(SUCHSPRACHE_ZEILEN).toBe(SUCHARTEN.length + FELD_ZEILEN.length);
  });
});
