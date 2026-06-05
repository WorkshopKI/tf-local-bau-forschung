import type { IDBStore } from '../storage/idb-store';
import { CSV_STORES, type CsvStoreName } from '../storage/idb-store';
import { readText } from '../infrastructure/atomic-write';
import type { ProgrammSnapshotManifest, SnapshotStoreName } from './snapshot';
import { SYNC_VERSION_KEY, SYNC_STORE_HASH_KEY, SYNC_LAST_CHECK_DAY_KEY } from './snapshot-keys';
import { MAX_WRITES_PER_TX } from './constants';
import { rebuildAntraegeListView } from './list-view-migration';

export interface SyncProgress {
  phase: 'manifest' | 'store' | 'finalizing' | 'done';
  currentStore?: SnapshotStoreName;
  storesDone: number;
  storesTotal: number;
  /**
   * Monotone Gesamt-Fraktion 0..1 über ALLE Phasen (Manifest → Stores →
   * List-View-Rebuild), inkl. Chunk-Fortschritt innerhalb großer Stores. Damit
   * bewegt sich der Banner-Balken von Anfang an, statt erst nach dem großen
   * antraege-Store (~4 s) zu springen.
   */
  fraction: number;
}

// Fortschritts-Budget der drei Phasen (Summe = 1.0). Der antraege-Store + der
// abschließende List-View-Rebuild dominieren die Wall-Clock-Zeit.
const PROG_MANIFEST = 0.05;
const PROG_STORES = 0.65;
const PROG_REBUILD = 0.30;

export interface SyncResult {
  synced: boolean;
  snapshotVersion?: string;
  createdAt?: string;
  /** Welche Stores wirklich neu geladen wurden (Hash-Mismatch). */
  reloadedStores?: SnapshotStoreName[];
}

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

export interface SyncOptions {
  onProgress?: (p: SyncProgress) => void;
  /**
   * Day-Throttle ueberspringen — fuer User-getriggerte Refreshes (z.B.
   * Banner-Klick „Jetzt laden", wenn der Watcher einen neueren Snapshot
   * gefunden hat). Default `false`: 1x/Tag wie bisher.
   */
  force?: boolean;
}

/**
 * Synchronisiert einen Programm-Snapshot von Daten-Share → lokale IDB.
 *
 * Drosselung: maximal 1x pro Kalendertag (lokale Zeit), ueberspringbar mit
 * `force: true`. Beim ersten Aufruf des Tages wird der
 * `snapshot-last-check-day-<programmId>`-Marker SOFORT gesetzt — auch wenn
 * der Sync danach skipped, faillt oder kein Manifest findet. Damit prueft
 * jeder Client wirklich nur 1x pro Tag.
 */
export async function syncProgrammSnapshot(
  idb: IDBStore,
  smbHandle: FileSystemDirectoryHandle,
  programmId: string,
  optsOrOnProgress?: SyncOptions | ((p: SyncProgress) => void),
): Promise<SyncResult> {
  const opts: SyncOptions = typeof optsOrOnProgress === 'function'
    ? { onProgress: optsOrOnProgress }
    : (optsOrOnProgress ?? {});
  const onProgress = opts.onProgress;

  // Day-Throttle (ueberspringbar via opts.force)
  const today = todayKey();
  if (!opts.force) {
    const lastCheckDay = await idb.get<string>(SYNC_LAST_CHECK_DAY_KEY(programmId));
    if (lastCheckDay === today) {
      return { synced: false };
    }
  }

  // Verzeichnisstruktur navigieren — bei jedem Step kann das Programm-Snapshot fehlen
  let programmDir: FileSystemDirectoryHandle;
  try {
    const programm = await smbHandle.getDirectoryHandle('programm');
    const antraegeDir = await programm.getDirectoryHandle('antraege');
    const snapshotDir = await antraegeDir.getDirectoryHandle('snapshot');
    programmDir = await snapshotDir.getDirectoryHandle(programmId);
  } catch {
    // Verzeichnis nicht reachable — keinen Marker setzen, naechster App-Start
    // versucht es erneut (transient outage darf nicht den ganzen Tag blockieren).
    return { synced: false };
  }

  // Manifest lesen
  onProgress?.({ phase: 'manifest', storesDone: 0, storesTotal: 0, fraction: 0 });
  let manifest: ProgrammSnapshotManifest;
  try {
    const manifestText = await readText(programmDir, 'manifest.json');
    if (!manifestText) return { synced: false };
    manifest = JSON.parse(manifestText) as ProgrammSnapshotManifest;
  } catch {
    return { synced: false };
  }

  // Manifest erfolgreich gelesen — JETZT den Day-Marker setzen. Damit blockiert
  // ein transient SMB-Outage den User nicht fuer den ganzen Tag.
  await idb.set(SYNC_LAST_CHECK_DAY_KEY(programmId), today);

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
    // Fortschritt inkl. Chunk-Fraktion innerhalb des aktuellen Stores: der Balken
    // bewegt sich auch während des großen antraege-Stores (statt erst danach).
    const reportStore = (storeFraction: number): void => {
      const storesProg = storeKeys.length > 0 ? (storesDone + storeFraction) / storeKeys.length : 1;
      onProgress?.({
        phase: 'store',
        currentStore: storeKey,
        storesDone,
        storesTotal: storeKeys.length,
        fraction: PROG_MANIFEST + PROG_STORES * storesProg,
      });
    };
    reportStore(0);
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
    let items: unknown[];
    try {
      items = jsonl
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as unknown);
    } catch (parseErr) {
      console.warn(`[snapshot-sync] ${storeKey}: malformed JSONL, skip store`, parseErr);
      storesDone++;
      continue;
    }

    await replaceStore(idb, STORE_TARGETS[storeKey], items, (done, total) => {
      reportStore(total > 0 ? done / total : 1);
    });
    await idb.set(SYNC_STORE_HASH_KEY(programmId, storeKey), remoteHash);
    reloadedStores.push(storeKey);
    storesDone++;
  }

  // Der Snapshot enthält nur den vollen ANTRAEGE-Store, NICHT die Slim-
  // Projektion ANTRAEGE_LIST_VIEW (die Listen/Dashboards/Home lesen). Nach
  // einem In-Session-Sync (Banner „Jetzt laden") muss sie hier neu projiziert
  // werden — sonst liest die Home die leere/stale Projektion und bleibt bis zum
  // nächsten App-Start (= manueller Reload, der ensureListViewProjection neu
  // laufen lässt) leer. Nur nötig, wenn der ANTRAEGE-Store wirklich neu kam.
  if (reloadedStores.includes('antraege')) {
    await rebuildAntraegeListView(idb, (done, total) => {
      const f = total > 0 ? done / total : 1;
      onProgress?.({
        phase: 'finalizing',
        storesDone: storeKeys.length,
        storesTotal: storeKeys.length,
        fraction: PROG_MANIFEST + PROG_STORES + PROG_REBUILD * f,
      });
    });
  }

  await idb.set(SYNC_VERSION_KEY(programmId), manifest.snapshotVersion);
  onProgress?.({ phase: 'done', storesDone, storesTotal: storeKeys.length, fraction: 1 });

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
async function replaceStore(
  idb: IDBStore,
  storeName: CsvStoreName,
  items: unknown[],
  onChunk?: (done: number, total: number) => void,
): Promise<void> {
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
    onChunk?.(Math.min(i + MAX_WRITES_PER_TX, items.length), items.length);
  }
}
