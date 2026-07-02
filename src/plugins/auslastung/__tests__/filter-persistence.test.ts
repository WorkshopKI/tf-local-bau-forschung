import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readZuweisungFilters,
  persistZuweisungFilters,
  readKlassifizierungFilters,
  readMaListeFilters,
  persistMaListeFilters,
} from '../views/filterPersistence';

/**
 * Filter-Persistenz der Auslastungs-Tabs — Round-trip + defensive Validierung.
 * Test-Env ist 'node' (kein DOM), daher ein minimaler in-memory localStorage-Stub.
 */
function makeLocalStorage(): { store: Map<string, string>; api: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> } {
  const store = new Map<string, string>();
  return {
    store,
    api: {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  };
}

describe('filterPersistence', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    const ls = makeLocalStorage();
    store = ls.store;
    vi.stubGlobal('localStorage', ls.api);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('liefert Defaults bei leerem Storage', () => {
    expect(readZuweisungFilters()).toEqual({ kategorie: '', antragstyp: '', status: 'offen', sort: 'akronym_asc' });
    expect(readKlassifizierungFilters()).toEqual({ filter: 'alle', kategorie: '', antragstyp: '' });
    expect(readMaListeFilters()).toEqual({ kategorie: '', antragstyp: '', showInactive: false });
  });

  it('Round-trip: persistierte Werte werden wieder gelesen', () => {
    persistZuweisungFilters({ kategorie: 'KI', antragstyp: 'FuE', status: 'zugewiesen', sort: 'fkz_asc' });
    expect(readZuweisungFilters()).toEqual({ kategorie: 'KI', antragstyp: 'FuE', status: 'zugewiesen', sort: 'fkz_asc' });
  });

  it('fällt bei ungültigen Enum-Werten auf Default zurück; Kategorie bleibt frei', () => {
    store.set(
      'tf-auslastung-zuweisung-filters',
      JSON.stringify({ kategorie: 'X', antragstyp: 'ZZZ', status: 'bogus', sort: 'nope' }),
    );
    expect(readZuweisungFilters()).toEqual({ kategorie: 'X', antragstyp: '', status: 'offen', sort: 'akronym_asc' });
  });

  it('fällt bei kaputtem JSON auf Default zurück', () => {
    store.set('tf-auslastung-klassifizierung-filters', '{ not json');
    expect(readKlassifizierungFilters()).toEqual({ filter: 'alle', kategorie: '', antragstyp: '' });
  });

  it('showInactive nur bei echtem boolean true', () => {
    store.set('tf-auslastung-maliste-filters', JSON.stringify({ showInactive: 'yes' }));
    expect(readMaListeFilters().showInactive).toBe(false);
    persistMaListeFilters({ kategorie: '', antragstyp: '', showInactive: true });
    expect(readMaListeFilters().showInactive).toBe(true);
  });
});
