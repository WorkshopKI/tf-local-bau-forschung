/**
 * Persistenz des EINEN aktiven Batch-Jobs im generischen `kv`-Store unter
 * `gutachten-batch:aktiv` — additiv, KEIN dedizierter Object-Store/Version-Bump
 * (vermeidet `file://`-`onblocked`-Upgrades bei parallel offenen Varianten,
 * Pitfall #29).
 */
import type { IDBStore } from '@/core/services/storage';
import { batchJobPath } from '@/core/services/personal-storage/personal-layout';
import {
  mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror,
} from '@/core/services/personal-storage/state-mirror';
import type { BatchJob } from './types';

const KEY = 'gutachten-batch:aktiv';

// IDB ist Primary; JSON-Spiegel (Singleton) im persönlichen Ordner macht den
// aktiven Job browser-wechsel-fest → Resume nach Browser-Wechsel. Best-effort.
export async function getBatchJob(idb: IDBStore): Promise<BatchJob | null> {
  const fromIdb = await idb.get<BatchJob>(KEY);
  if (fromIdb) return fromIdb;
  const fromDisk = await hydrateJsonFromPersonal<BatchJob>(idb, batchJobPath());
  if (fromDisk) {
    await idb.set(KEY, fromDisk);
    return fromDisk;
  }
  return null;
}

export async function putBatchJob(idb: IDBStore, job: BatchJob): Promise<void> {
  await idb.set(KEY, job);
  await mirrorJsonToPersonal(idb, batchJobPath(), job);
}

export async function deleteBatchJob(idb: IDBStore): Promise<void> {
  await idb.delete(KEY);
  await removePersonalMirror(idb, batchJobPath());
}
