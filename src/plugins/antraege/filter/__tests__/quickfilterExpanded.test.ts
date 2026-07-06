import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadExpandedSeg,
  saveExpandedSeg,
  toggleExpandedSeg,
  DEFAULT_EXPANDED_SEG,
  type QuickfilterSegId,
} from '../quickfilterExpanded';

/** Node-Testumgebung hat kein localStorage — einfacher In-Memory-Stub. */
function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('toggleExpandedSeg — Akkordeon-Reducer', () => {
  it('Klick auf ein geschlossenes Segment öffnet es', () => {
    expect(toggleExpandedSeg(null, 'antragstyp')).toBe('antragstyp');
  });
  it('Klick auf ein ANDERES Segment wechselt (schließt das vorherige implizit)', () => {
    expect(toggleExpandedSeg('status', 'precheck')).toBe('precheck');
  });
  it('Klick auf das bereits offene Segment schließt es', () => {
    expect(toggleExpandedSeg('status', 'status')).toBeNull();
  });
  it('Invariante: das Ergebnis ist immer höchstens EIN Segment (nie zwei offen)', () => {
    // Der Zustand ist ein Einzelwert → „zwei offen" ist strukturell unmöglich.
    const segs: QuickfilterSegId[] = ['status', 'antragstyp', 'precheck', 'sort'];
    let state: QuickfilterSegId | null = null;
    for (const s of segs) {
      state = toggleExpandedSeg(state, s);
      expect(state === null || segs.includes(state)).toBe(true);
    }
  });
});

describe('loadExpandedSeg / saveExpandedSeg — Persistenz', () => {
  beforeEach(() => { installLocalStorageStub(); });
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

  it('Erstnutzung (kein Schlüssel) → Default „status"', () => {
    expect(loadExpandedSeg('meine_offenen')).toBe(DEFAULT_EXPANDED_SEG);
    expect(DEFAULT_EXPANDED_SEG).toBe('status');
  });

  it('Round-Trip: gespeichertes Segment wird wieder geladen', () => {
    saveExpandedSeg('alle', 'precheck');
    expect(loadExpandedSeg('alle')).toBe('precheck');
  });

  it('„alles zugeklappt" (null) persistiert als eigener Zustand (nicht Default)', () => {
    saveExpandedSeg('alle', null);
    expect(loadExpandedSeg('alle')).toBeNull();
  });

  it('pro View getrennt', () => {
    saveExpandedSeg('alle', 'sort');
    saveExpandedSeg('meine_offenen', 'antragstyp');
    expect(loadExpandedSeg('alle')).toBe('sort');
    expect(loadExpandedSeg('meine_offenen')).toBe('antragstyp');
  });

  it('kaputter/ungültiger Wert → Default', () => {
    globalThis.localStorage.setItem('teamflow_antraege_quickfilter_expanded_alle', 'gruppieren');
    expect(loadExpandedSeg('alle')).toBe(DEFAULT_EXPANDED_SEG);
  });
});

describe('loadExpandedSeg — ohne localStorage (Node)', () => {
  it('fällt sauber auf den Default zurück (kein Throw)', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(loadExpandedSeg('alle')).toBe(DEFAULT_EXPANDED_SEG);
  });
});
