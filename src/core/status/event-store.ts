/**
 * Persistenz der Status-Historie (dedizierter Store `status_event`, IDBStore v11).
 *
 * Append-only: nach außen gibt es nur `appendEvents` (add) und Lese-Zugriffe —
 * KEINE Update-/Delete-API (Anti-Pattern: Events mutieren/löschen, auch kein
 * „Aufräumen" ignorierter Felder). Raw-Transaktionen über `idb.getDb()`.
 */
import type { IDBStore } from '@/core/services/storage';
import { STATUS_EVENT_STORE } from './stores';
import type { StatusEvent } from './event-typen';

/** Hängt Events an (add — id ist eindeutig). Ein Aufruf = eine Transaktion. */
export async function appendEvents(idb: IDBStore, events: readonly StatusEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATUS_EVENT_STORE, 'readwrite');
    const s = tx.objectStore(STATUS_EVENT_STORE);
    for (const e of events) s.add(e);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Alle Events eines Verbunds (unsortiert; Reihenfolge via `sortiereEvents`). */
export async function getStatusEvents(idb: IDBStore, verbundId: string): Promise<StatusEvent[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STATUS_EVENT_STORE, 'readonly');
    const req = tx.objectStore(STATUS_EVENT_STORE).index('verbundId').getAll(verbundId);
    req.onsuccess = () => resolve(req.result as StatusEvent[]);
    req.onerror = () => reject(req.error);
  });
}
