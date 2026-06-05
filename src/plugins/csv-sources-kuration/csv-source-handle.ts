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
import { parseCsvPreview } from '@/core/services/csv';
import { validateHeaders } from './services/csv-drift-check';
import { saveSharedCsvFilenames } from './csv-source-filenames';
// Keys in Core definiert (zentrale IDB-Key-Registry) — die Per-Datei-Handles
// werden beim App-Start von refreshAllPermissions re-granted (v2.19.1), das
// Ordner-Handle ersetzt sie als Re-Grant-Ziel (v2.27).
import {
  CSV_SOURCE_HANDLES_IDB_KEY as HANDLES_IDB_KEY,
  CSV_SOURCE_DIR_HANDLE_IDB_KEY as DIR_HANDLE_IDB_KEY,
  CSV_SOURCE_DIR_FILEMAP_IDB_KEY as DIR_FILEMAP_IDB_KEY,
} from '@/core/services/infrastructure/types';

type PermState = 'granted' | 'denied' | 'prompt';

interface FsFileHandleExt extends FileSystemFileHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

interface FsDirHandleExt extends FileSystemDirectoryHandle {
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

// ---------------------------------------------------------------------------
// v2.27: EIN Ordner-Handle für alle CSV-Quellen (Kaskade statt N Per-Datei-
// Handles). Re-Grant des Ordner-Handles deckt alle enthaltenen CSVs mit EINEM
// Prompt ab → umgeht das one-prompt-per-gesture-Limit (siehe
// CSV_SOURCE_DIR_HANDLE_IDB_KEY in infrastructure/types.ts).
// ---------------------------------------------------------------------------

export async function getCsvSourceDirHandle(
  idb: IDBStore,
): Promise<FileSystemDirectoryHandle | null> {
  return (await idb.get<FileSystemDirectoryHandle>(DIR_HANDLE_IDB_KEY)) ?? null;
}

export async function setCsvSourceDirHandle(
  idb: IDBStore,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await idb.set(DIR_HANDLE_IDB_KEY, handle);
}

export async function clearCsvSourceDirHandle(idb: IDBStore): Promise<void> {
  await idb.delete(DIR_HANDLE_IDB_KEY);
  await idb.delete(DIR_FILEMAP_IDB_KEY);
}

/** Lokale (nicht synchronisierte) Zuordnung schemaId → Dateiname im Ordner. */
type DirFileMap = Record<string, string>;

export async function getCsvDirFileMap(idb: IDBStore): Promise<DirFileMap> {
  return (await idb.get<DirFileMap>(DIR_FILEMAP_IDB_KEY)) ?? {};
}

/** Merge-Update der Filemap (überschreibt nur die übergebenen schemaIds). */
export async function setCsvDirFileMapEntries(idb: IDBStore, entries: DirFileMap): Promise<void> {
  const map = await getCsvDirFileMap(idb);
  await idb.set(DIR_FILEMAP_IDB_KEY, { ...map, ...entries });
}

export async function queryCsvSourceDirPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermState> {
  return (handle as FsDirHandleExt).queryPermission({ mode: 'read' });
}

/** MUSS aus einem User-Gesture aufgerufen werden (Browser-Constraint). */
export async function requestCsvSourceDirPermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermState> {
  return (handle as FsDirHandleExt).requestPermission({ mode: 'read' });
}

/**
 * Löst die zu einem Schema gehörende CSV-Datei INNERHALB des verknüpften
 * Ordner-Handles auf. Die Permission kaskadiert vom (bereits granted)
 * Verzeichnis-Handle auf die Kind-Datei — kein eigener Datei-Prompt nötig.
 *
 * Match-Strategie:
 *  1. `knownFileName` (lokale Filemap) bzw. `schema.source_file_name` gesetzt +
 *     Datei existiert → direkt `getFileHandle` (nur Metadaten, KEIN Scan/Parse).
 *  2. sonst: alle `.csv`-Dateien des Ordners gegen das Schema validieren
 *     (`parseCsvPreview` + `validateHeaders`), die Datei mit den meisten
 *     gematchten Spalten (>0) nehmen. Begründung: `source_file_name` ist auf
 *     pl-Schemas (Snapshot-Import) nicht zuverlässig gesetzt. Dieser Pfad ist
 *     teuer (liest+parst jede CSV) — Caller cachen den Treffer in der lokalen
 *     Filemap, damit er pro Quelle nur EINMAL läuft (Perf-Fix v2.27.2).
 *
 * Nicht-rekursiv — erfasst nur Dateien DIREKT im gewählten Ordner. Liefert
 * `null`, wenn keine passende Datei gefunden wird.
 */
export async function resolveFileViaDir(
  dirHandle: FileSystemDirectoryHandle,
  schema: CsvSchema,
  knownFileName?: string,
): Promise<{ file: File; fileName: string } | null> {
  // 1. bekannter Dateiname (Filemap > source_file_name) — schneller Pfad ohne Scan
  for (const candidate of [knownFileName, schema.source_file_name]) {
    if (!candidate) continue;
    try {
      const fh = await dirHandle.getFileHandle(candidate);
      return { file: await fh.getFile(), fileName: candidate };
    } catch {
      /* nicht (mehr) gefunden → nächster Kandidat / Header-Fallback */
    }
  }
  // 2. Header-Fallback: beste Übereinstimmung unter den .csv-Dateien
  let best: { file: File; fileName: string; score: number } | null = null;
  try {
    const iter = dirHandle as unknown as AsyncIterable<[string, FileSystemHandle]>;
    for await (const [name, handle] of iter) {
      if (handle.kind !== 'file') continue;
      if (!name.toLowerCase().endsWith('.csv')) continue;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        const preview = await parseCsvPreview(file, 1, {
          encoding: schema.encoding,
          separator: schema.separator,
        });
        const score = validateHeaders(schema, preview.headers).matched.length;
        if (score > 0 && (!best || score > best.score)) {
          best = { file, fileName: name, score };
        }
      } catch {
        /* unlesbare/inkompatible Datei überspringen */
      }
    }
  } catch {
    /* Verzeichnis nicht iterierbar (Permission?) → null */
  }
  return best ? { file: best.file, fileName: best.fileName } : null;
}

export type UpdateCheckResult =
  | { state: 'no_handle' }
  | { state: 'permission_required'; handle: FileSystemFileHandle | null; fileName: string }
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
  // v2.27: bevorzugt das verknüpfte Ordner-Handle (Permission kaskadiert auf
  // alle CSVs → ein Re-Grant deckt alle ab). Per-Datei-Handle bleibt Fallback.
  const dirHandle = await getCsvSourceDirHandle(idb);
  if (dirHandle) {
    let dirPerm: PermState;
    try {
      dirPerm = await queryCsvSourceDirPermission(dirHandle);
    } catch {
      dirPerm = 'prompt';
    }
    if (dirPerm !== 'granted') {
      const fallbackHandle = await getCsvSourceHandle(idb, schema.id);
      return {
        state: 'permission_required',
        handle: fallbackHandle,
        fileName: schema.source_file_name ?? schema.csv_source_name,
      };
    }
    const fileMap = await getCsvDirFileMap(idb);
    const resolved = await resolveFileViaDir(dirHandle, schema, fileMap[schema.id]);
    if (resolved) {
      // Self-Heal: gescannten Treffer in die lokale Filemap schreiben, damit der
      // nächste Lauf den schnellen Pfad nimmt (kein erneuter Ordner-Scan/Parse).
      if (fileMap[schema.id] !== resolved.fileName) {
        await setCsvDirFileMapEntries(idb, { [schema.id]: resolved.fileName });
      }
      const recorded = schema.source_last_modified ?? null;
      if (recorded != null && resolved.file.lastModified <= recorded) {
        return { state: 'up_to_date', lastModified: resolved.file.lastModified, fileName: resolved.fileName };
      }
      return {
        state: 'update_available',
        lastModified: resolved.file.lastModified,
        fileName: resolved.fileName,
        previousLastModified: recorded,
      };
    }
    // Ordner verknüpft + granted, aber Datei nicht (mehr) drin → Per-Datei-Pfad.
  }

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
): Promise<{ file: File; handle: FileSystemFileHandle | null }> {
  // v2.27: bevorzugt das Ordner-Handle (Permission kaskadiert auf die Datei).
  // `handle: null` signalisiert dem Caller, KEIN veraltetes Per-Datei-Handle
  // nachzuziehen (`persistCsvSourceMeta`/`persistSourceMeta` guarden auf null).
  const dirHandle = await getCsvSourceDirHandle(idb);
  if (dirHandle) {
    const schema = await getSchema(idb, schemaId);
    if (schema) {
      const perm = await queryCsvSourceDirPermission(dirHandle);
      if (perm !== 'granted') {
        const granted = await requestCsvSourceDirPermission(dirHandle);
        if (granted !== 'granted') throw new Error('Ordner-Zugriff nicht erlaubt.');
      }
      const fileMap = await getCsvDirFileMap(idb);
      const resolved = await resolveFileViaDir(dirHandle, schema, fileMap[schema.id]);
      if (resolved) {
        if (fileMap[schema.id] !== resolved.fileName) {
          await setCsvDirFileMapEntries(idb, { [schema.id]: resolved.fileName });
        }
        return { file: resolved.file, handle: null };
      }
      // Datei nicht im Ordner → Per-Datei-Handle als Fallback versuchen.
    }
  }

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

export interface LinkSourceResult {
  /** True wenn ein Handle gespeichert wurde; false wenn der User den Picker abbrach. */
  linked: boolean;
}

/**
 * v2.18: Verknüpft eine (per Snapshot bekannte) CSV-Quelle mit einer lokalen
 * Datei. Öffnet den Datei-Picker (MUSS aus einem User-Gesture laufen — Browser-
 * Constraint), prüft grob ob die Datei zum Schema passt und legt das
 * `FileSystemFileHandle` ab. Danach kann der Auto-Refresh-Check die Quelle
 * normal auf neuere `lastModified`-Stände prüfen.
 *
 * Hintergrund: Nicht-Kurator-Builds (pl) bekommen die Schemas über den Share-
 * Snapshot, aber nie ein Handle (das entsteht sonst nur im Kurator-Wizard).
 * Dieser Picker schließt die Lücke ohne das volle Kuration-Plugin.
 *
 * `source_last_modified` wird bewusst NICHT überschrieben — so wird eine
 * neuere Datei beim nächsten Check korrekt zum Update-Kandidaten.
 *
 * Wirft, wenn die Datei offensichtlich nicht zum Schema passt (keine einzige
 * bekannte Spalte) oder der Browser keinen persistierbaren Picker bietet.
 */
export async function pickAndLinkCsvSource(
  idb: IDBStore,
  schema: CsvSchema,
): Promise<LinkSourceResult> {
  const win = window as typeof window & {
    showOpenFilePicker?: (opts?: {
      types?: { description?: string; accept: Record<string, string[]> }[];
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  };
  if (typeof win.showOpenFilePicker !== 'function') {
    throw new Error('Datei-Verknüpfung braucht Chrome oder Edge (File System Access API).');
  }

  let handle: FileSystemFileHandle;
  try {
    const handles = await win.showOpenFilePicker({
      types: [{ description: 'CSV-Datei', accept: { 'text/csv': ['.csv'] } }],
      multiple: false,
    });
    const picked = handles[0];
    if (!picked) return { linked: false };
    handle = picked;
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return { linked: false };
    throw err;
  }

  const file = await handle.getFile();
  const preview = await parseCsvPreview(file, 1, {
    encoding: schema.encoding,
    separator: schema.separator,
  });
  const validation = validateHeaders(schema, preview.headers);
  if (validation.matched.length === 0) {
    throw new Error(
      `Diese Datei passt nicht zu „${schema.csv_source_name}" — keine bekannte Spalte gefunden. Falsche Datei gewählt?`,
    );
  }

  await setCsvSourceHandle(idb, schema.id, handle);
  return { linked: true };
}

export interface LinkFolderResult {
  /** True wenn ein Ordner-Handle gespeichert wurde; false bei Abbruch. */
  linked: boolean;
  /** schemaIds, die im Ordner einer Datei zugeordnet werden konnten. */
  matched: string[];
  /** Anzeige-Namen der Schemas, für die keine Datei gefunden wurde. */
  unmatched: string[];
}

/**
 * v2.27: Verknüpft ALLE CSV-Quellen über EIN Ordner-Handle statt N Per-Datei-
 * Handles. Öffnet `showDirectoryPicker` (MUSS aus einem User-Gesture laufen —
 * Browser-Constraint), ordnet jedes Schema einer Datei im Ordner zu
 * (`resolveFileViaDir`) und legt das Verzeichnis-Handle ab.
 *
 * Vorteil: Das Ordner-Handle wird beim App-Start mit EINEM Prompt re-granted
 * und die Permission kaskadiert auf alle CSVs — der Auto-Refresh-Banner fragt
 * nach einem Neustart nicht mehr pro Datei nach Verknüpfung (Fix des
 * one-prompt-per-gesture-Bugs auf der pl-Variante).
 *
 * Migration: für gematchte Schemas wird das nun überflüssige Per-Datei-Handle
 * entfernt (`removeCsvSourceHandle`).
 *
 * Wirft, wenn keine einzige Datei zum Schema passt (falscher Ordner?) oder der
 * Browser keinen Verzeichnis-Picker bietet.
 */
export async function pickAndLinkCsvFolder(
  idb: IDBStore,
  schemas: CsvSchema[],
): Promise<LinkFolderResult> {
  const win = window as typeof window & {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof win.showDirectoryPicker !== 'function') {
    throw new Error('Ordner-Verknüpfung braucht Chrome oder Edge (File System Access API).');
  }

  let dirHandle: FileSystemDirectoryHandle;
  try {
    dirHandle = await win.showDirectoryPicker({ mode: 'read' });
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return { linked: false, matched: [], unmatched: [] };
    throw err;
  }

  const matched: string[] = [];
  const unmatched: string[] = [];
  const fileMap: DirFileMap = {};
  for (const schema of schemas) {
    const resolved = await resolveFileViaDir(dirHandle, schema);
    if (resolved) { matched.push(schema.id); fileMap[schema.id] = resolved.fileName; }
    else unmatched.push(schema.csv_source_name);
  }

  if (matched.length === 0) {
    throw new Error(
      'In diesem Ordner wurde keine passende CSV-Datei gefunden. Falscher Ordner gewählt?',
    );
  }

  await setCsvSourceDirHandle(idb, dirHandle);
  // Lokale Filemap schreiben → künftige checkSourceForUpdate-Läufe nehmen den
  // schnellen getFileHandle-Pfad statt den Ordner zu scannen (Perf v2.27.2).
  await setCsvDirFileMapEntries(idb, fileMap);
  // v2.28: Zuordnung team-weit auf den Daten-Ordner spiegeln, damit andere PLs
  // nur noch den Ordner freigeben müssen (kein Scan). Best-effort (Schreibrecht).
  await saveSharedCsvFilenames(idb, fileMap);
  // Migration: gematchte Quellen brauchen ihr altes Per-Datei-Handle nicht mehr.
  for (const schemaId of matched) {
    await removeCsvSourceHandle(idb, schemaId);
  }
  return { linked: true, matched, unmatched };
}
