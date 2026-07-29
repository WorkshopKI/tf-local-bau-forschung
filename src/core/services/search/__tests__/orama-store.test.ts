import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ensureOramaDB, createOramaDB, destroyOrama, getOramaDB, getCurrentDimensions,
  insertDoc, getDocCount, persistOramaSoon, flushOramaPersist,
} from '../orama-store';

/** Minimal-IDB: nur `set`, mehr braucht der Persistenz-Pfad nicht. */
function fakeIdb(): { set: (k: string, v: unknown) => Promise<void>; calls: string[] } {
  const calls: string[] = [];
  return { calls, set: async (k: string) => { calls.push(k); } };
}

const doc = (id: string, dims: number): Parameters<typeof insertDoc>[0] => ({
  id, text: 'Vorhabensbeschreibung Text', title: 'VB.pdf', source: 'VB.pdf',
  tags: 'ZKN122220,vorhabensbeschreibung', type: 'dokument',
  embedding: new Array(dims).fill(0) as number[],
});

describe('orama-store: ensureOramaDB', () => {
  beforeEach(() => { destroyOrama(); });
  afterEach(() => { destroyOrama(); });

  it('legt bei fehlender DB eine neue an und meldet das', () => {
    expect(getOramaDB()).toBeNull();
    expect(ensureOramaDB(768)).toBe(true);
    expect(getOramaDB()).not.toBeNull();
    expect(getCurrentDimensions()).toBe(768);
  });

  it('laesst eine bestehende DB unangetastet', () => {
    createOramaDB(768);
    insertDoc(doc('a', 768));
    expect(ensureOramaDB(384)).toBe(false);
    // Weder neu erstellt noch die Dimension umgebogen — der Inhalt bleibt.
    expect(getCurrentDimensions()).toBe(768);
    expect(getDocCount()).toBe(1);
  });

  it('Kaltstart: insertDoc wirft nach ensureOramaDB nicht mehr', () => {
    // Regression zum gemeldeten Fehler "Orama not initialized": frische Variant-IDB,
    // nie ein Vollindexlauf gelaufen, nichts vom Share — die Ablage legt selbst an.
    expect(() => insertDoc(doc('vb-1', 768))).toThrow('Orama not initialized');
    ensureOramaDB(768);
    expect(() => insertDoc(doc('vb-1', 768))).not.toThrow();
    expect(getDocCount()).toBe(1);
  });
});

describe('orama-store: persistOramaSoon', () => {
  beforeEach(() => { vi.useFakeTimers(); destroyOrama(); createOramaDB(768); });
  afterEach(() => { vi.useRealTimers(); destroyOrama(); });

  it('koalesziert mehrere schnelle Aufrufe zu genau einem Schreibvorgang', async () => {
    const idb = fakeIdb();
    insertDoc(doc('a', 768));
    persistOramaSoon(idb);
    insertDoc(doc('b', 768));
    persistOramaSoon(idb);
    insertDoc(doc('c', 768));
    persistOramaSoon(idb);

    expect(idb.calls).toHaveLength(0); // nachlaufend, nicht sofort
    await vi.advanceTimersByTimeAsync(2000);
    await flushOramaPersist(idb);
    expect(idb.calls).toEqual(['orama-db']);
  });

  it('destroyOrama verwirft ein ausstehendes Speichern', async () => {
    const idb = fakeIdb();
    insertDoc(doc('a', 768));
    persistOramaSoon(idb);
    destroyOrama();
    await vi.advanceTimersByTimeAsync(2000);
    expect(idb.calls).toHaveLength(0);
  });
});
