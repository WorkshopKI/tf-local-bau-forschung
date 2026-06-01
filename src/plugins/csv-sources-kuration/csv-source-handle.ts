/**
 * Persistierung der `FileSystemFileHandle` pro CsvSchema.
 *
 * Hintergrund: damit die App eine "Datenaktualisierung" anbieten kann, müssen
 * wir die Datei am ursprünglichen Pfad wieder anfassen können — nicht nur die
 * SMB-Kopie unter `programm/csv-sources/`. Der Picker (`showOpenFilePicker`)
 * liefert ein persistierbares Handle, das wir in IDB ablegen und beim
 * nächsten App-Start für eine `lastModified`-Probe wiederverwenden.
 *
 * IDB-Layout: Key `csv-source-handles` → `Record<schemaId, FileSystemFileHandle>`
 * (analog zu `smb-handles` in infrastructure/smb-handle.ts).
 *
 * Permission-Modell: FSAPI-Handles brauchen nach Browser-Restart ein neues
 * `requestPermission` aus einem User-Gesture. `queryPermission` ist silent.
 * Wir checken automatisch nur Handles, die bereits `granted` sind. Für alles
 * andere bleibt der "CSV neu wählen"-Button als manueller Re-Pick-Pfad.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { getSchema, putSchema } from '@/core/services/csv/idb-csv';

const HANDLES_IDB_KEY = 'csv-source-handles';

type PermState = 'granted' | 'denied' | 'prompt';

interface FsFileHandleExt extends FileSystemFileHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

type HandleMap = Record<string, FileSystemFileHandle>;

async function readAll(idb: IDBStore): Promise<HandleMap> {
  return (await idb.get<HandleMap>(HANDLES_IDB_KEY)) ?? {};
}

async function writeAll(idb: IDBStore, map: HandleMap): Promise<void> {
  await idb.set(HANDLES_IDB_KEY, map);
}

export async function setCsvSourceHandle(
  idb: IDBStore,
  schemaId: string,
  handle: FileSystemFileHandle,
): Promise<void> {
  const map = await readAll(idb);
  map[schemaId] = handle;
  await writeAll(idb, map);
}

export async function getCsvSourceHandle(
  idb: IDBStore,
  schemaId: string,
): Promise<FileSystemFileHandle | null> {
  const map = await readAll(idb);
  return map[schemaId] ?? null;
}

export async function removeCsvSourceHandle(
  idb: IDBStore,
  schemaId: string,
): Promise<void> {
  const map = await readAll(idb);
  if (!(schemaId in map)) return;
  delete map[schemaId];
  await writeAll(idb, map);
}

export async function queryCsvSourcePermission(
  handle: FileSystemFileHandle,
): Promise<PermState> {
  return (handle as FsFileHandleExt).queryPermission({ mode: 'read' });
}

/** MUSS aus einem User-Gesture aufgerufen werden (Browser-Constraint). */
export async function requestCsvSourcePermission(
  handle: FileSystemFileHandle,
): Promise<PermState> {
  return (handle as FsFileHandleExt).requestPermission({ mode: 'read' });
}

export type UpdateCheckResult =
  | { state: 'no_handle' }
  | { state: 'permission_required'; handle: FileSystemFileHandle; fileName: string }
  | { state: 'file_missing'; reason: string }
  | { state: 'up_to_date'; lastModified: number; fileName: string }
  | { state: 'update_available'; lastModified: number; fileName: string; previousLastModified: number | null };

/**
 * Silent-Check: schaut nur in `queryPermission`, ruft NIE `requestPermission`.
 * Geeignet für automatisches Polling beim Page-Mount. Ein Banner mit
 * "Aktualisieren"-Button erledigt das `requestPermission` später aus dem
 * Klick-Gesture.
 */
export async function checkSourceForUpdate(
  idb: IDBStore,
  schema: CsvSchema,
): Promise<UpdateCheckResult> {
  const handle = await getCsvSourceHandle(idb, schema.id);
  if (!handle) return { state: 'no_handle' };
  let perm: PermState;
  try {
    perm = await queryCsvSourcePermission(handle);
  } catch {
    return { state: 'permission_required', handle, fileName: schema.source_file_name ?? handle.name };
  }
  if (perm !== 'granted') {
    return { state: 'permission_required', handle, fileName: schema.source_file_name ?? handle.name };
  }
  let file: File;
  try {
    file = await handle.getFile();
  } catch (err) {
    return { state: 'file_missing', reason: (err as Error).message || 'Datei nicht erreichbar' };
  }
  const recorded = schema.source_last_modified ?? null;
  if (recorded != null && file.lastModified <= recorded) {
    return { state: 'up_to_date', lastModified: file.lastModified, fileName: file.name };
  }
  return {
    state: 'update_available',
    lastModified: file.lastModified,
    fileName: file.name,
    previousLastModified: recorded,
  };
}

/**
 * Holt die Datei zum gespeicherten Handle — fordert ggf. Permission an
 * (muss aus einem User-Gesture aufgerufen werden). Wirft bei Permission-
 * Verweigerung oder fehlender Datei.
 */
export async function loadFileFromStoredHandle(
  idb: IDBStore,
  schemaId: string,
): Promise<{ file: File; handle: FileSystemFileHandle }> {
  const handle = await getCsvSourceHandle(idb, schemaId);
  if (!handle) throw new Error('Kein gespeicherter Datei-Handle für dieses Schema.');
  const perm = await queryCsvSourcePermission(handle);
  if (perm !== 'granted') {
    const granted = await requestCsvSourcePermission(handle);
    if (granted !== 'granted') {
      throw new Error('Datei-Zugriff nicht erlaubt.');
    }
  }
  const file = await handle.getFile();
  return { file, handle };
}

/**
 * Persistiert nach einem (Re-)Import die Quelldatei-Metadaten eines Schemas:
 *  - das `FileSystemFileHandle` (für künftige Auto-Update-Checks), falls vorhanden,
 *  - `source_file_name` + `source_last_modified` auf dem Schema-Record.
 *
 * Audit-Logging bleibt bewusst beim Aufrufer — die Event-Semantik unterscheidet
 * sich je nach Trigger (Reselect / Auto-Update / neue Spalten übernommen).
 * Wird von `CsvSourceReimportDialog` und `CsvAddColumnsDialog` geteilt.
 */
export async function persistCsvSourceMeta(
  idb: IDBStore,
  opts: { schema: CsvSchema; file: File; sourceHandle: FileSystemFileHandle | null },
): Promise<void> {
  const { schema, file, sourceHandle } = opts;
  if (sourceHandle) {
    try {
      await setCsvSourceHandle(idb, schema.id, sourceHandle);
    } catch (e) {
      console.warn('[csv-source-handle] persist failed', e);
    }
  }
  const fresh = await getSchema(idb, schema.id);
  if (fresh) {
    await putSchema(idb, {
      ...fresh,
      source_file_name: file.name,
      source_last_modified: file.lastModified,
    });
  }
}
