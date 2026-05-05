/**
 * IDB-CRUD für den Phase-2-Scan-Manifest-Store.
 *
 * KeyPath: filename. Indexe: matched_antrag_id, triage_state.
 * Optional: JSONL-Spiegelung auf den Daten-Share unter SCAN_MANIFEST_PATH
 * (wird nicht von dieser Datei verwaltet — Caller entscheidet wann gespiegelt
 * wird, z.B. nach Batch-Abschluss).
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import { PHASE2_STORES } from '../../core/services/storage/idb-store';
import type { ManifestEntry } from '../types';

export async function putManifestEntry(idb: IDBStore, entry: ManifestEntry): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readwrite');
    tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getManifestEntry(idb: IDBStore, filename: string): Promise<ManifestEntry | null> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readonly');
    const req = tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).get(filename);
    req.onsuccess = () => resolve((req.result as ManifestEntry) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listManifestEntries(idb: IDBStore): Promise<ManifestEntry[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readonly');
    const req = tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).getAll();
    req.onsuccess = () => resolve((req.result as ManifestEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteManifestEntry(idb: IDBStore, filename: string): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readwrite');
    tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).delete(filename);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Loescht alle Manifest-Eintraege. Liefert Anzahl der geloeschten Eintraege. */
export async function clearAllManifest(idb: IDBStore): Promise<number> {
  const all = await listManifestEntries(idb);
  const count = all.length;
  const db = idb.getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readwrite');
    tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return count;
}
