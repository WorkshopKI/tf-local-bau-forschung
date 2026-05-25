/**
 * Unit-Tests fuer benachrichtigung-Logik (1.17).
 *
 * Testet die pure Funktion `findNeueAntraegeIds` + localStorage-Helfer
 * direkt (ohne React-Test-Library, die das Projekt nicht installiert hat).
 * vitest laeuft mit environment='node', deshalb stubben wir localStorage
 * manuell als globalThis-Patch.
 */
import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';

// In-Memory localStorage-Polyfill — vitest-node hat kein DOM.
function makeMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    clear() { store = {}; },
    getItem(key) { return store[key] ?? null; },
    key(i) { return Object.keys(store)[i] ?? null; },
    removeItem(key) { delete store[key]; },
    setItem(key, value) { store[key] = String(value); },
  };
}

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as { localStorage: Storage }).localStorage = makeMemoryStorage();
  }
});
afterAll(() => {
  // kein cleanup — anderer Tests nutzen den Stub ggf. weiter; harmlos.
});
import {
  benachrichtigungStorageKey,
  findNeueAntraegeIds,
  readLastSeen,
  writeLastSeen,
} from '../hooks/useBenachrichtigung';
import type { Klassifizierung } from '../types';

function makeKlass(
  antragId: string,
  primaer: string,
  freigegebenAm: string | undefined,
  status: 'vorgeschlagen' | 'freigegeben' = 'freigegeben',
): Klassifizierung {
  return {
    antragId,
    vorgeschlagenePrimaer: null,
    vorgeschlageneAspekte: [],
    freigegebenePrimaer: primaer,
    freigegebeneAspekte: [],
    vorgeschlageneKategorien: [],
    freigegebeneKategorien: primaer ? [primaer] : [],
    status,
    freigegebenAm,
  };
}

describe('findNeueAntraegeIds', () => {
  it('zaehlt nur freigegebene Antraege der Haupt-Kategorie', () => {
    const klass = [
      makeKlass('A1', 'IT', '2026-05-20T10:00:00.000Z'),
      makeKlass('A2', 'DT', '2026-05-20T10:00:00.000Z'),
      makeKlass('A3', 'IT', '2026-05-20T10:00:00.000Z', 'vorgeschlagen'),
      makeKlass('A4', 'IT', undefined),
    ];
    expect(findNeueAntraegeIds(klass, 'IT', 0)).toEqual(['A1']);
  });

  it('respektiert lastSeenMs — Antraege davor werden ignoriert', () => {
    const klass = [
      makeKlass('A1', 'IT', '2026-05-15T10:00:00.000Z'),
      makeKlass('A2', 'IT', '2026-05-20T10:00:00.000Z'),
    ];
    const cutoff = Date.parse('2026-05-17T00:00:00.000Z');
    expect(findNeueAntraegeIds(klass, 'IT', cutoff)).toEqual(['A2']);
  });

  it('myHauptKategorie leer → []', () => {
    const klass = [makeKlass('A1', 'IT', '2026-05-20T10:00:00.000Z')];
    expect(findNeueAntraegeIds(klass, '', 0)).toEqual([]);
  });

  it('Fallback auf freigegebeneKategorien[0]', () => {
    const k: Klassifizierung = {
      antragId: 'A1',
      vorgeschlagenePrimaer: null,
      vorgeschlageneAspekte: [],
      freigegebenePrimaer: '',
      freigegebeneAspekte: [],
      vorgeschlageneKategorien: [],
      freigegebeneKategorien: ['IT'],
      status: 'freigegeben',
      freigegebenAm: '2026-05-20T10:00:00.000Z',
    };
    expect(findNeueAntraegeIds([k], 'IT', 0)).toEqual(['A1']);
  });

  it('leere klassifizierungen → []', () => {
    expect(findNeueAntraegeIds([], 'IT', 0)).toEqual([]);
  });

  it('freigegebenAm ungueltig → ignoriert', () => {
    const k = makeKlass('A1', 'IT', 'not-a-date');
    expect(findNeueAntraegeIds([k], 'IT', 0)).toEqual([]);
  });
});

describe('localStorage-Helfer', () => {
  beforeEach(() => localStorage.clear());

  it('storageKey ist pro anonId einzigartig', () => {
    expect(benachrichtigungStorageKey('MA01')).not.toBe(benachrichtigungStorageKey('MA02'));
  });

  it('readLastSeen ohne anonId → Infinity (nie neu)', () => {
    expect(readLastSeen(null)).toBe(Number.POSITIVE_INFINITY);
  });

  it('readLastSeen ohne Eintrag → 0 (alles neu)', () => {
    expect(readLastSeen('MA01')).toBe(0);
  });

  it('write + read Roundtrip', () => {
    const iso = '2026-05-20T10:00:00.000Z';
    writeLastSeen('MA01', iso);
    expect(readLastSeen('MA01')).toBe(Date.parse(iso));
  });

  it('writeLastSeen mit Quota-Fehler → keine Exception', () => {
    const original = localStorage.setItem;
    localStorage.setItem = vi.fn(() => { throw new Error('QuotaExceededError'); });
    try {
      expect(() => writeLastSeen('MA01', '2026-05-20T10:00:00.000Z')).not.toThrow();
    } finally {
      localStorage.setItem = original;
    }
  });

  it('readLastSeen mit ungueltigem Eintrag → 0', () => {
    localStorage.setItem(benachrichtigungStorageKey('MA01'), 'garbage');
    expect(readLastSeen('MA01')).toBe(0);
  });
});
