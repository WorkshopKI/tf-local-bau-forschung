import { describe, it, expect } from 'vitest';
import {
  pushRecentSearch, filterRecentSearches, zaehleAnfrage, beschneideZaehler, haeufigsteAnfragen,
} from '../suchseite-utils';

describe('pushRecentSearch', () => {
  it('setzt eine neue (getrimmte) Anfrage nach vorne', () => {
    expect(pushRecentSearch(['alt'], '  neu  ')).toEqual(['neu', 'alt']);
  });

  it('ignoriert zu kurze Anfragen (len<2) und gibt die Liste unverändert (gleiche Referenz) zurück', () => {
    const list = ['standard'];
    expect(pushRecentSearch(list, 'a')).toBe(list);
    expect(pushRecentSearch(list, '  ')).toBe(list);
  });

  it('dedupet case-insensitiv und schiebt den Treffer nach vorne (move-to-front)', () => {
    expect(pushRecentSearch(['a-frage', 'Standard', 'b-frage'], 'standard'))
      .toEqual(['standard', 'a-frage', 'b-frage']);
  });

  it('Prefix-Suppression: ältere Präfixe der neuen Anfrage fallen raus', () => {
    expect(pushRecentSearch(['standard', 'andere'], 'standardisierung'))
      .toEqual(['standardisierung', 'andere']);
  });

  it('behält längere Einträge, von denen die neue Anfrage ein Präfix ist', () => {
    expect(pushRecentSearch(['standardisierung'], 'standard'))
      .toEqual(['standard', 'standardisierung']);
  });

  it('kappt auf max', () => {
    const list = ['e4', 'e3', 'e2', 'e1'];
    expect(pushRecentSearch(list, 'neu', 3)).toEqual(['neu', 'e4', 'e3']);
  });
});

describe('filterRecentSearches', () => {
  const list = ['standardisierung', 'protease nachweis', 'cannabis wachstum'];

  it('leere Query → die max jüngsten Einträge', () => {
    expect(filterRecentSearches(list, '', 2)).toEqual(['standardisierung', 'protease nachweis']);
  });

  it('case-insensitiver Substring-Match', () => {
    expect(filterRecentSearches(list, 'NACH')).toEqual(['protease nachweis']);
  });

  it('schließt den Eintrag aus, der exakt der aktuellen Query entspricht', () => {
    expect(filterRecentSearches(list, 'standardisierung')).toEqual([]);
  });

  it('kappt auf max', () => {
    const many = ['aa1', 'aa2', 'aa3', 'aa4'];
    expect(filterRecentSearches(many, 'aa', 2)).toEqual(['aa1', 'aa2']);
  });
});

/**
 * „Häufig gesucht" — bis v4.110 die zweite Hälfte der Rezenzliste, also
 * ausgerechnet das, was am LÄNGSTEN nicht gesucht wurde (der Verlauf ist
 * Move-to-front: was oft gestellt wird, steht vorn). Seit v4.111 wird gezählt.
 */
describe('zaehleAnfrage', () => {
  it('zählt hoch und faltet die Schreibweise', () => {
    // Zwischen den beiden Läufen liegt eine andere Anfrage — sonst wäre es
    // derselbe Besuch (siehe unten).
    const eins = zaehleAnfrage({}, 'Laser', ['anderes'], ['Laser', 'anderes']);
    const zwei = zaehleAnfrage(eins, 'laser', ['anderes', 'Laser'], ['laser', 'anderes']);
    expect(zwei).toEqual({ laser: 2 });
  });

  it('zählt NICHT, was ohnehin schon vorn steht', () => {
    // Der Kern des Fixes: das Suchfeld committet auch bei jedem Fokusverlust
    // (`onSearchBlur`) und `confirmAnalyse` noch einmal. Gemessen stand eine
    // Anfrage nach zwei Fokusverlusten bei 2, ohne je wiederholt worden zu sein.
    const stand = { laser: 1 };
    expect(zaehleAnfrage(stand, 'laser', ['laser', 'x'], ['laser', 'x'])).toEqual(stand);
    expect(zaehleAnfrage(stand, 'LASER', ['laser'], ['LASER'])).toEqual(stand);
  });

  it('wirft ab, was der Verlauf nicht mehr führt', () => {
    // Kappung und Präfix-Unterdrückung entfernen Einträge — ihre Zählung darf
    // nicht als Karteileiche zurückbleiben.
    expect(zaehleAnfrage({ laser: 5, alt: 3 }, 'laser', ['alt'], ['laser'])).toEqual({ laser: 6 });
  });

  it('zählt nichts, was gar nicht in den Verlauf kam', () => {
    // `pushRecentSearch` ignoriert Anfragen unter zwei Zeichen.
    expect(zaehleAnfrage({}, 'a', [], [])).toEqual({});
  });

  it('überlebt einen kaputten Stand', () => {
    expect(zaehleAnfrage({ laser: 0, x: -1 } as Record<string, number>, 'laser', [], ['laser']))
      .toEqual({ laser: 1 });
  });
});

describe('beschneideZaehler', () => {
  it('behält nur, was der Verlauf noch führt', () => {
    expect(beschneideZaehler({ a: 2, weg: 9 }, ['A'])).toEqual({ a: 2 });
  });

  it('zählt dabei nichts hoch — das ✕ an einer Zeile ist keine Suche', () => {
    expect(beschneideZaehler({ a: 2 }, ['a'])).toEqual({ a: 2 });
  });
});

describe('haeufigsteAnfragen', () => {
  const verlauf = ['neu', 'laser', 'normung', 'einmalig'];
  const zaehler = { neu: 1, laser: 4, normung: 2, einmalig: 1 };

  it('ordnet nach Häufigkeit, nicht nach Alter', () => {
    expect(haeufigsteAnfragen(zaehler, verlauf, [], 5)).toEqual(['laser', 'normung']);
  });

  it('lässt weg, was einmal gesucht wurde — einmal ist nicht häufig', () => {
    expect(haeufigsteAnfragen(zaehler, verlauf, [], 5)).not.toContain('einmalig');
  });

  it('nennt nichts, was schon unter „Zuletzt gesucht" steht', () => {
    // Sonst stünde dieselbe Anfrage zweimal auf einer Seite, unter zwei
    // verschiedenen Überschriften.
    expect(haeufigsteAnfragen(zaehler, verlauf, ['neu', 'laser'], 5)).toEqual(['normung']);
  });

  it('bleibt leer, solange sich nichts wiederholt hat', () => {
    expect(haeufigsteAnfragen({ a1: 1, a2: 1 }, ['a1', 'a2'], [], 5)).toEqual([]);
  });

  it('entscheidet Gleichstand nach Aktualität', () => {
    expect(haeufigsteAnfragen({ alt: 2, jung: 2 }, ['jung', 'alt'], [], 5)).toEqual(['jung', 'alt']);
  });

  it('kappt auf max', () => {
    expect(haeufigsteAnfragen({ a: 5, b: 4, c: 3 }, ['a', 'b', 'c'], [], 2)).toEqual(['a', 'b']);
  });
});
