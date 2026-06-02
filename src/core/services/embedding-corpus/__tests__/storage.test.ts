/**
 * Tests für den Embedding-Korpus-Storage-Layer.
 *
 * Fokus: `loadAllEmbeddings` liest seit dem Perf-Patch den Korpus in EINER
 * Transaktion via `IDBStore.entries(prefix)` (statt N einzelner get()-Roundtrips).
 * Hier wird geprüft, dass das Ergebnis identisch bleibt: nur Embedding-Keys,
 * Prefix gestrippt, Fremd-Keys ignoriert.
 *
 * Nutzt `fake-indexeddb` (wie idb-store.test.ts), Node-Vitest-fähig.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import {
  EMBEDDING_CORPUS_IDB_PREFIX,
  loadAllEmbeddings,
  storeEmbedding,
} from '../storage';

async function freshStore(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('loadAllEmbeddings', () => {
  it('lädt alle Embeddings, strippt den Prefix, ignoriert Fremd-Keys', async () => {
    const store = await freshStore();
    await storeEmbedding(store, '16EP260086', [0.1, 0.2, 0.3]);
    await storeEmbedding(store, '16KN123126', [0.4, 0.5, 0.6]);
    // Fremd-Keys im selben kv-Store dürfen nicht auftauchen.
    await store.set('teamflow_tour_completed', true);
    await store.set('some:other:key', { foo: 1 });

    const map = await loadAllEmbeddings(store);

    expect(map.size).toBe(2);
    expect(map.get('16EP260086')).toEqual([0.1, 0.2, 0.3]);
    expect(map.get('16KN123126')).toEqual([0.4, 0.5, 0.6]);
    // kein Prefix mehr in den Keys
    expect([...map.keys()].some(k => k.startsWith(EMBEDDING_CORPUS_IDB_PREFIX))).toBe(false);
  });

  it('liefert dieselbe Map wie der alte keys()+get()-Pfad', async () => {
    const store = await freshStore();
    await storeEmbedding(store, 'A', [1, 0]);
    await storeEmbedding(store, 'B', [0, 1]);
    await store.set('config:theme', 'dark');

    // Referenz: alter Pfad (keys(prefix) + einzelne get()).
    const keys = await store.keys(EMBEDDING_CORPUS_IDB_PREFIX);
    const ref = new Map<string, number[]>();
    for (const k of keys) {
      const v = await store.get<number[]>(k);
      if (Array.isArray(v)) ref.set(k.slice(EMBEDDING_CORPUS_IDB_PREFIX.length), v);
    }

    expect(await loadAllEmbeddings(store)).toEqual(ref);
  });

  it('leerer Korpus → leere Map', async () => {
    const store = await freshStore();
    await store.set('config:theme', 'dark');
    expect((await loadAllEmbeddings(store)).size).toBe(0);
  });
});
