/** Handle-Ablage und Ordner-Picker — das Innenleben dieses Ordners. */
import { IDBStore } from '@/core/services/storage/idb-store';
import { SMB_HANDLES_IDB_KEY } from '../types';
import { mitLokalenHandles, ohneLokaleHandles, lokalerSlotHandle } from '../local-fs/slots';


export type PermState = 'granted' | 'denied' | 'prompt';

export interface FsDirHandle extends FileSystemDirectoryHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

/** Wie FsDirHandle, aber fuer Datei-Handles (z.B. CSV-Quelldateien). */
export interface FsFileHandle extends FileSystemFileHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

export type Handles = Record<string, FileSystemDirectoryHandle>;

/**
 * EINZIGE Lesestelle der Handle-Map — alle fuenf Getter (`getDatenShareHandle`,
 * `getDokumentenquelleHandle`, `getDmsSourceHandle`, Persoenlich,
 * UserFoldersRoot) und damit saemtliche Aufrufer laufen hier durch.
 *
 * Genau deshalb haengt die Variante „local" hier ein: ein Zweig, ~240 Call-Sites.
 * Die synthetischen Handles melden `queryPermission → 'granted'`, wodurch
 * `listPendingGrants` leer bleibt und der StartupScreen sich selbst weiterfaehrt.
 */
export async function readAll(idb: IDBStore): Promise<Handles> {
  const existing = (await idb.get<Handles>(SMB_HANDLES_IDB_KEY)) ?? {};
  return __TEAMFLOW_LOCAL_FS__ ? mitLokalenHandles(existing) : existing;
}

/**
 * Gegenstueck zu `readAll`: synthetische Handles muessen VOR dem Persistieren
 * wieder raus. Sie tragen Methoden und sind nicht structured-cloneable —
 * `idb.set` wuerfe `DataCloneError`, und zwar auf einem Pfad, der bei JEDEM
 * Start laeuft (App.tsx → migrateLegacyDmsSource → hier) und den Fehler nur als
 * `console.warn` zeigt.
 */
export async function writeAll(idb: IDBStore, handles: Handles): Promise<void> {
  await idb.set(SMB_HANDLES_IDB_KEY, __TEAMFLOW_LOCAL_FS__ ? ohneLokaleHandles(handles) : handles);
}

export type PickResult =
  | { ok: true; handle: FileSystemDirectoryHandle }
  | { ok: false; reason: 'unsupported' | 'aborted' | 'error'; message?: string };

export async function pickDirectory(
  mode: 'read' | 'readwrite' = 'readwrite',
  slot?: string,
): Promise<FileSystemDirectoryHandle | { aborted: true } | { error: string }> {
  // Variante „local": nie den nativen Picker oeffnen. Der Dialog ist per
  // Browser-Sicherheit nicht skriptbar — er wuerde eine laufende Automation
  // stumm blockieren. Stattdessen direkt den konfigurierten Ordner liefern.
  if (__TEAMFLOW_LOCAL_FS__ && slot) {
    const handle = lokalerSlotHandle(slot);
    if (handle) return handle;
    return { error: `Variante "local": fuer Slot "${slot}" ist kein Ordner konfiguriert.` };
  }
  if (!('showDirectoryPicker' in window)) {
    return { error: 'File System Access API nicht verfügbar (falscher Browser?)' };
  }
  try {
    return await (window as typeof window & {
      showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker({ mode, startIn: 'documents' });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'AbortError') return { aborted: true };
    return { error: `${name}: ${(err as Error).message || String(err)}` };
  }
}
