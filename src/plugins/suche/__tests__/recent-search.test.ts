import { describe, it, expect } from 'vitest';
import { pushRecentSearch, filterRecentSearches } from '../suchseite-utils';

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
