/**
 * Persistenz des EINEN aktiven Batch-Jobs im generischen `kv`-Store unter
 * `gutachten-batch:aktiv` — additiv, KEIN dedizierter Object-Store/Version-Bump
 * (vermeidet `file://`-`onblocked`-Upgrades bei parallel offenen Varianten,
 * Pitfall #29).
 */
import type { IDBStore } from '@/core/services/storage';
import type { BatchJob } from './types';

const KEY = 'gutachten-batch:aktiv';

export async function getBatchJob(idb: IDBStore): Promise<BatchJob | null> {
  return idb.get<BatchJob>(KEY);
}

export async function putBatchJob(idb: IDBStore, job: BatchJob): Promise<void> {
  await idb.set(KEY, job);
}

export async function deleteBatchJob(idb: IDBStore): Promise<void> {
  await idb.delete(KEY);
}
