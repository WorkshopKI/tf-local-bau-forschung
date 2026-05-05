/**
 * History der letzten Scan-Runs pro Pfad-Liste — Grundlage fuer die ETA-
 * Schaetzung beim Re-Scan derselben Pfade.
 *
 * Wird im selben IDB-Eintrag wie selected_paths gehalten (ScanConfigEntry.
 * last_runs), damit nur ein Singleton-Store gepflegt werden muss.
 */
import type { IDBStore } from '../../core/services/storage/idb-store';
import { PHASE2_STORES } from '../../core/services/storage/idb-store';
import { getScanConfig } from './store';
import type { ScanConfigEntry, ScanRunHistoryEntry } from './types';

const MAX_HISTORY = 10;

/**
 * Hash einer Pfad-Liste. Sortiert + getrennt durch '|', damit unterschiedliche
 * Reihenfolge gleicher Pfade denselben Hash ergibt.
 */
export function pathsHash(paths: string[]): string {
  return [...paths].map(p => p.trim()).sort().join('|');
}

export async function getLastScanRun(
  idb: IDBStore,
  paths: string[],
): Promise<ScanRunHistoryEntry | null> {
  const cfg = await getScanConfig(idb);
  if (!cfg?.last_runs) return null;
  const hash = pathsHash(paths);
  return cfg.last_runs.find(r => r.paths_hash === hash) ?? null;
}

export async function recordScanRun(
  idb: IDBStore,
  paths: string[],
  total: number,
  durationMs: number,
): Promise<void> {
  const existing = await getScanConfig(idb);
  const hash = pathsHash(paths);
  const newEntry: ScanRunHistoryEntry = {
    paths_hash: hash,
    paths: [...paths],
    total,
    duration_ms: durationMs,
    ran_at: new Date().toISOString(),
  };
  // Alten Eintrag fuer denselben Hash rauswerfen, neuen vorne einreihen.
  const lastRuns = (existing?.last_runs ?? []).filter(r => r.paths_hash !== hash);
  lastRuns.unshift(newEntry);
  if (lastRuns.length > MAX_HISTORY) lastRuns.length = MAX_HISTORY;

  const updated: ScanConfigEntry = {
    id: 'default',
    selected_paths: existing?.selected_paths ?? [],
    updated_at: existing?.updated_at ?? new Date().toISOString(),
    last_runs: lastRuns,
  };

  const db = idb.getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PHASE2_STORES.SCAN_CONFIG, 'readwrite');
    tx.objectStore(PHASE2_STORES.SCAN_CONFIG).put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
