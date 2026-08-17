/**
 * Die Darstellungs-Achsen der Suche — vor allem: WANN sie überhaupt gelten.
 *
 * Der Kern dieser Datei ist die Ansicht-Bindung. Beide Achsen wirken nur auf die
 * Trefferliste; stünden sie in der Tabelle, böte das Menü zwei Schalter an, die
 * nichts bewegen. Genau das war gemeldet.
 */
import { describe, it, expect } from 'vitest';
import {
  baueSucheDarstellungsAchsen, vergleiche, parseSortierung, parseDichte,
  STANDARD_SORTIERUNG, STANDARD_DICHTE,
} from '../darstellungsAchsen';

describe('baueSucheDarstellungsAchsen', () => {
  it('bietet in der Liste Sortierung und Dichte', () => {
    const achsen = baueSucheDarstellungsAchsen({
      sortierung: 'relevanz', dichte: 'ausfuehrlich', ansicht: 'liste',
    });
    expect(achsen.map(a => a.id)).toEqual(['sortierung', 'dichte']);
  });

  it('bietet in der Tabelle KEINE Achse — dort wirkt weder Sortierung noch Dichte', () => {
    // Die Tabelle sortiert über ihre Spaltenköpfe (`useSearchResults.sorted`),
    // und ihre Zeile kennt kein `kompakt`. Ein leeres Ergebnis ist das Signal
    // an die Seite, den Knopf gar nicht erst zu rendern.
    expect(baueSucheDarstellungsAchsen({
      sortierung: 'fkz', dichte: 'kompakt', ansicht: 'tabelle',
    })).toEqual([]);
  });

  it('reicht die aktuellen Werte durch, damit „Zurücksetzen" das Richtige trifft', () => {
    const achsen = baueSucheDarstellungsAchsen({
      sortierung: 'neueste', dichte: 'kompakt', ansicht: 'liste',
    });
    expect(achsen.find(a => a.id === 'sortierung')?.value).toBe('neueste');
    expect(achsen.find(a => a.id === 'dichte')?.value).toBe('kompakt');
    expect(achsen.find(a => a.id === 'sortierung')?.standard).toBe(STANDARD_SORTIERUNG);
    expect(achsen.find(a => a.id === 'dichte')?.standard).toBe(STANDARD_DICHTE);
  });
});

describe('tolerante Leser', () => {
  it('fällt bei Unbekanntem auf den Standard zurück', () => {
    expect(parseSortierung(null)).toBe(STANDARD_SORTIERUNG);
    expect(parseSortierung('quatsch')).toBe(STANDARD_SORTIERUNG);
    expect(parseSortierung('fkz')).toBe('fkz');
    expect(parseDichte(null)).toBe(STANDARD_DICHTE);
    expect(parseDichte('kompakt')).toBe('kompakt');
  });
});

describe('vergleiche', () => {
  const a = { score: 0.4, bewilligungsdatum: '2021-03-01', fkz: '16KN0001' };
  const b = { score: 0.9, bewilligungsdatum: '2019-11-20', fkz: '16KN0002' };

  it('sortiert nach Relevanz absteigend', () => {
    expect(vergleiche(a, b, 'relevanz')).toBeGreaterThan(0);
  });

  it('sortiert nach Datum in beide Richtungen', () => {
    expect(vergleiche(a, b, 'neueste')).toBeLessThan(0);
    expect(vergleiche(a, b, 'aelteste')).toBeGreaterThan(0);
  });

  it('stellt Treffer ohne Datum ans Ende, nicht an den Anfang', () => {
    const ohne = { score: 0.1 };
    expect(vergleiche(ohne, a, 'neueste')).toBeGreaterThan(0);
  });
});
