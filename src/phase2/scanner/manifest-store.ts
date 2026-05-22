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

/**
 * v1.15: Liefert alle Manifest-Eintraege einer DMS-Source. Nutzt den
 * `by_source_id`-Index. Eintraege ohne `source_id` (vor v1.15) werden
 * transparent der Default-Source zugeordnet — d.h. wenn `sourceId === 'default'`,
 * werden zusaetzlich alle Eintraege mit `source_id === undefined` mitgeliefert.
 */
export async function listManifestEntriesBySource(
  idb: IDBStore,
  sourceId: string,
): Promise<ManifestEntry[]> {
  const db = idb.getDb();
  const direct = await new Promise<ManifestEntry[]>((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readonly');
    const idx = tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).index('by_source_id');
    const req = idx.getAll(sourceId);
    req.onsuccess = () => resolve((req.result as ManifestEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  if (sourceId !== 'default') return direct;
  // Default-Source schluckt zusaetzlich alle Eintraege ohne source_id
  // (Legacy-Eintraege vor v1.15).
  const all = await listManifestEntries(idb);
  const legacy = all.filter(e => e.source_id == null);
  return [...direct, ...legacy];
}

/**
 * Liefert alle Manifest-Eintraege, deren matched_antrag_id auf das gegebene
 * Aktenzeichen zeigt. Nutzt den `matched_antrag_id`-Index — kein Full-Table-
 * Scan, auch bei 100k+ Eintraegen sub-millisecond. Konsumenten:
 * TvDetailBlock/AntragDokumenteSection.
 */
export async function listByMatchedAntrag(
  idb: IDBStore,
  aktenzeichen: string,
): Promise<ManifestEntry[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_MANIFEST, 'readonly');
    const idx = tx.objectStore(PHASE2_STORES.SCAN_MANIFEST).index('matched_antrag_id');
    const req = idx.getAll(aktenzeichen);
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
