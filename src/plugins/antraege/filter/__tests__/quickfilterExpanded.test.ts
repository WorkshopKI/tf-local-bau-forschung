import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadExpandedSegs,
  saveExpandedSegs,
  toggleExpandedSeg,
  DEFAULT_EXPANDED_SEG,
  DEFAULT_EXPANDED_SEGS,
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

const menge = (...ids: QuickfilterSegId[]): Set<QuickfilterSegId> => new Set(ids);
const sortiert = (s: ReadonlySet<QuickfilterSegId>): string[] => [...s].sort();

describe('toggleExpandedSeg — auf/zu, ohne die anderen anzufassen', () => {
  it('Klick auf ein geschlossenes Segment öffnet es', () => {
    expect(sortiert(toggleExpandedSeg(menge(), 'antragstyp'))).toEqual(['antragstyp']);
  });

  it('Klick auf ein ANDERES Segment lässt das erste OFFEN — das war bis v3.12 anders', () => {
    expect(sortiert(toggleExpandedSeg(menge('status'), 'precheck')))
      .toEqual(['precheck', 'status']);
  });

  it('Klick auf das bereits offene Segment schließt nur dieses', () => {
    expect(sortiert(toggleExpandedSeg(menge('status', 'precheck'), 'status')))
      .toEqual(['precheck']);
  });

  it('gibt eine NEUE Menge zurück (React-State darf nicht mutiert werden)', () => {
    const vorher = menge('status');
    const nachher = toggleExpandedSeg(vorher, 'precheck');
    expect(nachher).not.toBe(vorher);
    expect(sortiert(vorher)).toEqual(['status']);
  });

  it('alle nacheinander geöffnet → alle offen', () => {
    const segs: QuickfilterSegId[] = ['status', 'antragstyp', 'projektart', 'precheck'];
    let state: ReadonlySet<QuickfilterSegId> = menge();
    for (const s of segs) state = toggleExpandedSeg(state, s);
    expect(state.size).toBe(segs.length);
  });
});

describe('loadExpandedSegs / saveExpandedSegs — Persistenz', () => {
  beforeEach(() => { installLocalStorageStub(); });
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

  it('Erstnutzung (kein Schlüssel) → Default „status"', () => {
    expect(sortiert(loadExpandedSegs('meine_offenen'))).toEqual(['status']);
    expect(DEFAULT_EXPANDED_SEG).toBe('status');
    expect(sortiert(DEFAULT_EXPANDED_SEGS)).toEqual(['status']);
  });

  it('Round-Trip: mehrere offene Segmente überleben', () => {
    saveExpandedSegs('alle', menge('precheck', 'antragstyp'));
    expect(sortiert(loadExpandedSegs('alle'))).toEqual(['antragstyp', 'precheck']);
  });

  it('„alles zugeklappt" persistiert als eigener Zustand (nicht Default)', () => {
    saveExpandedSegs('alle', menge());
    expect(loadExpandedSegs('alle').size).toBe(0);
  });

  it('ein ALTER Einzelwert liest sich als einelementige Menge', () => {
    // Bestand aus der Akkordeon-Zeit — darf nicht auf den Default zurückfallen.
    globalThis.localStorage.setItem('teamflow_antraege_quickfilter_expanded_alle', 'precheck');
    expect(sortiert(loadExpandedSegs('alle'))).toEqual(['precheck']);
  });

  it('pro View getrennt', () => {
    saveExpandedSegs('alle', menge('projektart'));
    saveExpandedSegs('meine_offenen', menge('antragstyp'));
    expect(sortiert(loadExpandedSegs('alle'))).toEqual(['projektart']);
    expect(sortiert(loadExpandedSegs('meine_offenen'))).toEqual(['antragstyp']);
  });

  it('unbekannter Eintrag reißt die übrigen nicht mit', () => {
    globalThis.localStorage.setItem(
      'teamflow_antraege_quickfilter_expanded_alle', 'gruppieren,precheck',
    );
    expect(sortiert(loadExpandedSegs('alle'))).toEqual(['precheck']);
  });

  it('nur Ungültiges → Default', () => {
    globalThis.localStorage.setItem('teamflow_antraege_quickfilter_expanded_alle', 'gruppieren');
    expect(sortiert(loadExpandedSegs('alle'))).toEqual(['status']);
  });

  it('derselbe Zustand ergibt denselben String (stabile Reihenfolge)', () => {
    saveExpandedSegs('a', menge('precheck', 'status'));
    const ersterStand = globalThis.localStorage.getItem('teamflow_antraege_quickfilter_expanded_a');
    saveExpandedSegs('a', menge('status', 'precheck'));
    expect(globalThis.localStorage.getItem('teamflow_antraege_quickfilter_expanded_a'))
      .toBe(ersterStand);
  });
});

describe('loadExpandedSegs — ohne localStorage (Node)', () => {
  it('fällt sauber auf den Default zurück (kein Throw)', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(sortiert(loadExpandedSegs('alle'))).toEqual(['status']);
  });
});
