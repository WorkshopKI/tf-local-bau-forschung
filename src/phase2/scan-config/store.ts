/**
 * IDB-CRUD fuer die persistierte Dev-Scan-Konfiguration (Singleton).
 */
import type { IDBStore } from '../../core/services/storage/idb-store';
import { PHASE2_STORES } from '../../core/services/storage/idb-store';
import type { ScanConfigEntry } from './types';

const SINGLETON_ID = 'default' as const;

export async function getScanConfig(idb: IDBStore): Promise<ScanConfigEntry | null> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_CONFIG, 'readonly');
    const req = tx.objectStore(PHASE2_STORES.SCAN_CONFIG).get(SINGLETON_ID);
    req.onsuccess = () => resolve((req.result as ScanConfigEntry | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveScanConfig(idb: IDBStore, paths: string[]): Promise<ScanConfigEntry> {
  const db = idb.getDb();
  const entry: ScanConfigEntry = {
    id: SINGLETON_ID,
    selected_paths: dedupePaths(paths),
    updated_at: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_CONFIG, 'readwrite');
    tx.objectStore(PHASE2_STORES.SCAN_CONFIG).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearScanConfig(idb: IDBStore): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_CONFIG, 'readwrite');
    tx.objectStore(PHASE2_STORES.SCAN_CONFIG).delete(SINGLETON_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const key = p.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
