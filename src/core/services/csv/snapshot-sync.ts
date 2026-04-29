import type { IDBStore } from '../storage/idb-store';
import { CSV_STORES, type CsvStoreName } from '../storage/idb-store';
import { readText } from '../infrastructure/atomic-write';
import type { ProgrammSnapshotManifest, SnapshotStoreName } from './snapshot';
import { MAX_WRITES_PER_TX } from './constants';

export interface SyncProgress {
  phase: 'manifest' | 'store' | 'done';
  currentStore?: SnapshotStoreName;
  storesDone: number;
  storesTotal: number;
}

export interface SyncResult {
  synced: boolean;
  snapshotVersion?: string;
  createdAt?: string;
  /** Welche Stores wirklich neu geladen wurden (Hash-Mismatch). */
  reloadedStores?: SnapshotStoreName[];
}

const SYNC_VERSION_KEY = (programmId: string) => `snapshot-version-${programmId}`;
const SYNC_STORE_HASH_KEY = (programmId: string, store: SnapshotStoreName) =>
  `snapshot-store-hash-${programmId}-${store}`;
const SYNC_LAST_CHECK_DAY_KEY = (programmId: string) => `snapshot-last-check-day-${programmId}`;

/** YYYY-MM-DD im lokalen Zeit-Sinne (User-orientiert). */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STORE_FILES: Record<SnapshotStoreName, string> = {
  antraege: 'antraege.jsonl',
  antrag_historie: 'antrag_historie.jsonl',
  verbuende: 'verbuende.jsonl',
  verbund_historie: 'verbund_historie.jsonl',
  akronym_index: 'akronym_index.jsonl',
  csv_row_hashes: 'csv_row_hashes.jsonl',
  programme: 'programme.jsonl',
  unterprogramme: 'unterprogramme.jsonl',
  csv_schemas: 'csv_schemas.jsonl',
};

const STORE_TARGETS: Record<SnapshotStoreName, CsvStoreName> = {
  antraege: CSV_STORES.ANTRAEGE,
  antrag_historie: CSV_STORES.ANTRAG_HISTORIE,
  verbuende: CSV_STORES.VERBUENDE,
  verbund_historie: CSV_STORES.VERBUND_HISTORIE,
  akronym_index: CSV_STORES.AKRONYM_INDEX,
  csv_row_hashes: CSV_STORES.CSV_ROW_HASHES,
  programme: CSV_STORES.PROGRAMME,
  unterprogramme: CSV_STORES.UNTERPROGRAMME,
  csv_schemas: CSV_STORES.CSV_SCHEMAS,
};

/**
 * Synchronisiert einen Programm-Snapshot von Daten-Share → lokale IDB.
 *
 * Drosselung: maximal 1x pro Kalendertag (lokale Zeit). Beim ersten Aufruf
 * des Tages wird der `snapshot-last-check-day-<programmId>`-Marker SOFORT
 * gesetzt — auch wenn der Sync danach skipped, faillt oder kein Manifest
 * findet. Damit prueft jeder Client wirklich nur 1x pro Tag.
 */
export async function syncProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult> {
  // Day-Throttle
  const today = todayKey();
  const lastCheckDay = await idb.get<string>(SYNC_LAST_CHECK_DAY_KEY(programmId));
  if (lastCheckDay === today) {
    return { synced: false };
  }
  await idb.set(SYNC_LAST_CHECK_DAY_KEY(programmId), today);

  // Verzeichnisstruktur navigieren — bei jedem Step kann das Programm-Snapshot fehlen
  let programmDir: FileSystemDirectoryHandle;
  try {
    const programm = await smbHandle.getDirectoryHandle('programm');
    const antraegeDir = await programm.getDirectoryHandle('antraege');
    const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot');
    programmDir = await snapshotDir.getDirectoryHandle(programmId);
  } catch {
    return { synced: false };
  }

  // Manifest lesen
  onProgress?.({ phase: 'manifest', storesDone: 0, storesTotal: 0 });
  let manifest: ProgrammSnapshotManifest;
  try {
    const manifestText = await readText(programmDir, 'manifest.json');
    if (!manifestText) return { synced: false };
    manifest = JSON.parse(manifestText) as ProgrammSnapshotManifest;
  } catch {
    return { synced: false };
  }

  // Idempotenz-Check
  const lastSyncedVersion = await idb.get<string>(SYNC_VERSION_KEY(programmId));
  if (lastSyncedVersion === manifest.snapshotVersion) {
    return { synced: false };
  }

  // Pro Store: Hash-Check + bei Mismatch laden
  const storeKeys = Object.keys(manifest.stores) as SnapshotStoreName[];
  const reloadedStores: SnapshotStoreName[] = [];
  let storesDone = 0;
  for (const storeKey of storeKeys) {
    onProgress?.({
      phase: 'store',
      currentStore: storeKey,
      storesDone,
      storesTotal: storeKeys.length,
    });
    const localHash = await idb.get<string>(SYNC_STORE_HASH_KEY(programmId, storeKey));
    const remoteHash = manifest.stores[storeKey].hash;
    if (localHash === remoteHash) {
      storesDone++;
      continue;
    }

    const jsonl = await readText(programmDir, STORE_FILES[storeKey]);
    if (jsonl === null) {
      console.warn(`[snapshot-sync] ${storeKey} fehlt im Snapshot, skip`);
      storesDone++;
      continue;
    }
    const items = jsonl
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as unknown);

    await replaceStore(idb, STORE_TARGETS[storeKey], items);
    await idb.set(SYNC_STORE_HASH_KEY(programmId, storeKey), remoteHash);
    reloadedStores.push(storeKey);
    storesDone++;
  }

  await idb.set(SYNC_VERSION_KEY(programmId), manifest.snapshotVersion);
  onProgress?.({ phase: 'done', storesDone, storesTotal: storeKeys.length });

  return {
    synced: true,
    snapshotVersion: manifest.snapshotVersion,
    createdAt: manifest.createdAt,
    reloadedStores,
  };
}

/**
 * clear() + chunked put, jeweils in eigener Transaction, weil Bulk-Inserts
 * mit 13k+ Items die TX-Lifetime ueberschreiten wuerden.
 */
async function replaceStore(idb: IDBStore, storeName: CsvStoreName, items: unknown[]): Promise<void> {
  const db = idb.getDb();

  // 1. clear()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite');
    t.objectStore(storeName).clear();
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

  // 2. chunked put
  for (let i = 0; i < items.length; i += MAX_WRITES_PER_TX) {
    const chunk = items.slice(i, i + MAX_WRITES_PER_TX);
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(storeName, 'readwrite');
      const s = t.objectStore(storeName);
      for (const item of chunk) {
        s.put(item);
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
}
