/**
 * Tests für IDBStore — Schema-Migration + CRUD im Default-`kv`-Store.
 *
 * Nutzt `fake-indexeddb` als Polyfill, damit die Tests Node-Vitest-fähig
 * bleiben (siehe vitest.config.mts environment: 'node'). Vor jedem Test wird
 * die IDB-Welt resetted, sonst persistieren Schema-Versionen zwischen Tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { CSV_STORES, FILTER_STORE_NAME, IDBStore, PHASE2_STORES } from '../idb-store';

async function freshStore(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

beforeEach(async () => {
  // fake-indexeddb hat eine globale Welt — komplett zurücksetzen vor jedem Test,
  // sonst persistieren Schema-Versionen und Daten zwischen Tests.
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

afterEach(() => {
  // Optionales Cleanup — fake-indexeddb hält keine Resources.
});

describe('IDBStore.open — Schema-Migration', () => {
  it('legt alle CSV/Filter/Phase2-Stores an (Versionen 1-6)', async () => {
    const store = await freshStore();
    const db = store.getDb();
    const names = Array.from(db.objectStoreNames);

    // v1: kv (Default)
    expect(names).toContain('kv');
    // v2: CSV-Domain
    for (const sn of Object.values(CSV_STORES)) {
      expect(names, `fehlt: ${sn}`).toContain(sn);
    }
    // v3: Filter
    expect(names).toContain(FILTER_STORE_NAME);
    // v5: Phase-2
    for (const sn of [PHASE2_STORES.SKIP_LIST, PHASE2_STORES.PENDING_ANTRAEGE, PHASE2_STORES.SCAN_MANIFEST]) {
      expect(names, `fehlt: ${sn}`).toContain(sn);
    }
    // v6: Scan-Config Singleton
    expect(names).toContain(PHASE2_STORES.SCAN_CONFIG);
  });

  it('legt erwartete Indices auf den CSV-Stores an', async () => {
    const store = await freshStore();
    const db = store.getDb();
    const tx = db.transaction([CSV_STORES.ANTRAEGE, CSV_STORES.UNTERPROGRAMME], 'readonly');

    const antraege = tx.objectStore(CSV_STORES.ANTRAEGE);
    expect(antraege.keyPath).toBe('aktenzeichen');
    const antrIdx = Array.from(antraege.indexNames);
    expect(antrIdx).toContain('programm_id');
    expect(antrIdx).toContain('verbund_id');
    expect(antrIdx).toContain('akronym');

    const up = tx.objectStore(CSV_STORES.UNTERPROGRAMME);
    expect(Array.from(up.indexNames)).toContain('programm_id');
  });

  it('Phase-2 SCAN_MANIFEST hat matched_antrag_id + triage_state Indices', async () => {
    const store = await freshStore();
    const db = store.getDb();
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readonly');
    const idx = Array.from(tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).indexNames);
    expect(idx).toContain('matched_antrag_id');
    expect(idx).toContain('triage_state');
  });

  it('open() ist idempotent (zweiter Aufruf no-op)', async () => {
    const store = new IDBStore();
    await store.open();
    await store.open(); // darf nicht crashen
    expect(store.getDb()).toBeDefined();
  });

  it('AKRONYM_INDEX nutzt Composite-Key [programm_id, akronym]', async () => {
    const store = await freshStore();
    const db = store.getDb();
    const s = db.transaction(CSV_STORES.AKRONYM_INDEX, 'readonly').objectStore(CSV_STORES.AKRONYM_INDEX);
    expect(s.keyPath).toEqual(['programm_id', 'akronym']);
  });
});

describe('IDBStore.get/set/delete/keys', () => {
  it('set+get rundet Wert exakt zurück', async () => {
    const store = await freshStore();
    await store.set('foo', { a: 1, b: 'x' });
    const v = await store.get<{ a: number; b: string }>('foo');
    expect(v).toEqual({ a: 1, b: 'x' });
  });

  it('get auf unbekanntem Key liefert null', async () => {
    const store = await freshStore();
    expect(await store.get('missing')).toBeNull();
  });

  it('delete entfernt einen Key', async () => {
    const store = await freshStore();
    await store.set('k', 42);
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });

  it('keys() liefert alle Schlüssel', async () => {
    const store = await freshStore();
    await store.set('a', 1);
    await store.set('b', 2);
    await store.set('c', 3);
    const keys = await store.keys();
    expect(keys.sort()).toEqual(['a', 'b', 'c']);
  });

  it('keys(prefix) filtert nach Präfix', async () => {
    const store = await freshStore();
    await store.set('user:1', { name: 'A' });
    await store.set('user:2', { name: 'B' });
    await store.set('config:theme', 'dark');
    const userKeys = await store.keys('user:');
    expect(userKeys.sort()).toEqual(['user:1', 'user:2']);
  });

  it('getDb() wirft wenn open() nicht aufgerufen', () => {
    const store = new IDBStore();
    expect(() => store.getDb()).toThrow('IDBStore not opened');
  });
});
