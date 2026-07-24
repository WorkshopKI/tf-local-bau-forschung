/**
 * End-to-End-Reconcile gegen fake-indexeddb (IDBStore v11). Läuft im Projekt
 * `isolated` (frische IDB-Welt je Test).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore, CSV_STORES } from '@/core/services/storage/idb-store';
import { reconcileStatusEvents } from '@/core/status/reconcile';
import { getStatusEvents } from '@/core/status/event-store';

async function put(idb: IDBStore, store: string, value: unknown): Promise<void> {
  const db = idb.getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('reconcileStatusEvents (Store)', () => {
  it('backfillt initial, ist idempotent und erfasst Änderungen', async () => {
    const idb = new IDBStore();
    await idb.open();
    await put(idb, CSV_STORES.VERBUENDE, {
      verbund_id: 'VB1', programm_id: 'P1', status: 'bewilligt', teilantrags_ids: ['AZ1'],
    });
    await put(idb, CSV_STORES.ANTRAEGE, {
      aktenzeichen: 'AZ1', programm_id: 'P1', verbund_id: 'VB1',
      status: 'gutachten fertig', vb_phase: 3, antragsdatum: '01.03.2024',
    });

    // 1. Lauf: Bestand backfillen (verbund_status + status + vb_phase + antragsdatum)
    const n1 = await reconcileStatusEvents(idb, 'P1', ['AZ1'], '2026-07-24T00:00:00.000Z');
    expect(n1).toBe(4);
    const ev1 = await getStatusEvents(idb, 'VB1');
    expect(ev1).toHaveLength(4);
    expect(ev1.every(e => e.quelle === 'initial')).toBe(true);

    // 2. Lauf ohne Änderung: idempotent
    const n2 = await reconcileStatusEvents(idb, 'P1', ['AZ1'], '2026-07-25T00:00:00.000Z');
    expect(n2).toBe(0);

    // 3. Lauf nach Status-Änderung: genau ein import-Event
    await put(idb, CSV_STORES.ANTRAEGE, {
      aktenzeichen: 'AZ1', programm_id: 'P1', verbund_id: 'VB1',
      status: 'bewilligt', vb_phase: 3, antragsdatum: '01.03.2024',
    });
    const n3 = await reconcileStatusEvents(idb, 'P1', ['AZ1'], '2026-07-26T00:00:00.000Z');
    expect(n3).toBe(1);

    const importEv = (await getStatusEvents(idb, 'VB1')).filter(e => e.quelle === 'import');
    expect(importEv).toHaveLength(1);
    expect(importEv[0]).toMatchObject({ feldId: 'status', wert: 'bewilligt', wertVorher: 'gutachten fertig', tvId: 'AZ1' });
  });
});
