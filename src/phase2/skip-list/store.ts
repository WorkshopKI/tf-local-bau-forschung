/**
 * IDB-CRUD für die Phase-2-Skip-Liste.
 *
 * Skip-Einträge identifizieren irrelevante Dateien per `filename` (DocID).
 * Ein Re-Scan überspringt diese Dateien komplett, auch wenn sich der Inhalt
 * geändert hat (typisch: Datums-Update im Anschreiben verändert Hash, aber
 * Dokument bleibt irrelevant). `classifier_version` erlaubt gezieltes
 * Re-Klassifizieren ohne Full-Rebuild.
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import { PHASE2_STORES } from '../../core/services/storage/idb-store';
import type { SkipListEntry } from '../types';

export async function putSkipEntry(idb: IDBStore, entry: SkipListEntry): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SKIP_LIST, 'readwrite');
    tx.objectStore(PHASE2_STORES.SKIP_LIST).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getSkipEntry(idb: IDBStore, filename: string): Promise<SkipListEntry | null> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SKIP_LIST, 'readonly');
    const req = tx.objectStore(PHASE2_STORES.SKIP_LIST).get(filename);
    req.onsuccess = () => resolve((req.result as SkipListEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSkipEntry(idb: IDBStore, filename: string): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SKIP_LIST, 'readwrite');
    tx.objectStore(PHASE2_STORES.SKIP_LIST).delete(filename);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listAllSkipEntries(idb: IDBStore): Promise<SkipListEntry[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SKIP_LIST, 'readonly');
    const req = tx.objectStore(PHASE2_STORES.SKIP_LIST).getAll();
    req.onsuccess = () => resolve((req.result as SkipListEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Gibt true zurück wenn die Datei in der Skip-Liste steht — Schnellpfad im Scanner. */
export async function isSkipped(idb: IDBStore, filename: string): Promise<boolean> {
  const e = await getSkipEntry(idb, filename);
  return e !== null;
}
