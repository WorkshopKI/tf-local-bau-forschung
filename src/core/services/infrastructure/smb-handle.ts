/**
 * SMB-Handle-Manager (Phase 1a + v1.9-Strukturkonsolidierung).
 *
 * Persistiert bis zu zwei File System Access API DirectoryHandles:
 *  - Daten-Share: Root-Ordner mit programm/, backups/, _intern/, README.txt
 *  - Dokumentenquelle (optional, Phase 2): separater Handle nur für Kurator-Scan
 *
 * IDB-Layout: Key `smb-handles` → `Record<string, FileSystemDirectoryHandle>`
 * mit Slots `daten-share` und `dokumentenquelle`. Legacy-Slot `test-programm`
 * wird beim Laden transparent als Daten-Share gelesen.
 */

import { IDBStore } from '@/core/services/storage/idb-store';
import {
  SMB_HANDLES_IDB_KEY,
  SMB_HANDLE_DATEN_SHARE,
  SMB_HANDLE_DOKUMENTENQUELLE,
  SMB_HANDLE_LEGACY_TEST_PROGRAMM,
  PROGRAMM_SUBDIRS,
  PROGRAMM_DIR_NAME,
  LEGACY_PROGRAMM_DIR_NAME,
  BACKUPS_DIR,
  INTERN_DIR,
  INTERN_FEEDBACK_DIR,
  HEARTBEAT_PROBE_PATH,
  README_PATH,
} from './types';

type PermState = 'granted' | 'denied' | 'prompt';

export interface FsDirHandle extends FileSystemDirectoryHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

type Handles = Record<string, FileSystemDirectoryHandle>;

async function readAll(idb: IDBStore): Promise<Handles> {
  const existing = await idb.get<Handles>(SMB_HANDLES_IDB_KEY);
  return existing ?? {};
}

async function writeAll(idb: IDBStore, handles: Handles): Promise<void> {
  await idb.set(SMB_HANDLES_IDB_KEY, handles);
}

export type PickResult =
  | { ok: true; handle: FileSystemDirectoryHandle }
  | { ok: false; reason: 'unsupported' | 'aborted' | 'error'; message?: string };

async function pickDirectory(): Promise<FileSystemDirectoryHandle | { aborted: true } | { error: string }> {
  if (!('showDirectoryPicker' in window)) {
    return { error: 'File System Access API nicht verfügbar (falscher Browser?)' };
  }
  try {
    return await (window as typeof window & {
      showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'AbortError') return { aborted: true };
    return { error: `${name}: ${(err as Error).message || String(err)}` };
  }
}

/** Öffnet den Picker und persistiert das Daten-Share-Handle. */
export async function pickAndStoreDatenShareHandle(idb: IDBStore): Promise<PickResult> {
  const res = await pickDirectory();
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return { ok: false, reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error', message: res.error };
  }
  const map = await readAll(idb);
  map[SMB_HANDLE_DATEN_SHARE] = res;
  // Legacy-Slot aufräumen falls noch gesetzt.
  delete map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  await writeAll(idb, map);
  return { ok: true, handle: res };
}

/** Öffnet den Picker und persistiert das Dokumentenquelle-Handle (separater Slot). */
export async function pickAndStoreDokumentenquelleHandle(idb: IDBStore): Promise<PickResult> {
  const res = await pickDirectory();
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return { ok: false, reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error', message: res.error };
  }
  const map = await readAll(idb);
  map[SMB_HANDLE_DOKUMENTENQUELLE] = res;
  await writeAll(idb, map);
  return { ok: true, handle: res };
}

/**
 * @deprecated Alter Name `pickAndStoreParentHandle`. Vor v1.9 kanonisch.
 * Delegiert auf pickAndStoreDatenShareHandle.
 */
export async function pickAndStoreParentHandle(idb: IDBStore): Promise<PickResult> {
  return pickAndStoreDatenShareHandle(idb);
}

/**
 * Liefert das Daten-Share-Handle. Fällt transparent auf Legacy-Slot `test-programm`
 * zurück, wenn noch keine Migration stattgefunden hat.
 */
export async function getDatenShareHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const map = await readAll(idb);
  return map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM] ?? null;
}

export async function getDokumentenquelleHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const map = await readAll(idb);
  return map[SMB_HANDLE_DOKUMENTENQUELLE] ?? null;
}

/** @deprecated Alias für getDatenShareHandle. */
export async function getSmbHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  return getDatenShareHandle(idb);
}

export async function clearDatenShareHandle(idb: IDBStore): Promise<void> {
  const map = await readAll(idb);
  delete map[SMB_HANDLE_DATEN_SHARE];
  delete map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  await writeAll(idb, map);
}

export async function clearDokumentenquelleHandle(idb: IDBStore): Promise<void> {
  const map = await readAll(idb);
  delete map[SMB_HANDLE_DOKUMENTENQUELLE];
  await writeAll(idb, map);
}

/** @deprecated Alias für clearDatenShareHandle. */
export async function clearSmbHandle(idb: IDBStore): Promise<void> {
  return clearDatenShareHandle(idb);
}

export async function queryPermission(handle: FileSystemDirectoryHandle): Promise<PermState> {
  return (handle as FsDirHandle).queryPermission({ mode: 'readwrite' });
}

/** MUSS aus einem User-Gesture-Handler aufgerufen werden. */
export async function refreshPermission(handle: FileSystemDirectoryHandle): Promise<PermState> {
  return (handle as FsDirHandle).requestPermission({ mode: 'readwrite' });
}

/**
 * Liefert das Programm-Handle (auf `programm/` unter dem Daten-Share).
 * Legt es an falls nicht vorhanden. Fällt auf `programm-test/` zurück wenn
 * die Migration noch nicht gelaufen ist.
 */
export async function getProgrammHandle(parent: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const existingNew = await parent.getDirectoryHandle(PROGRAMM_DIR_NAME).catch(() => null);
  if (existingNew) return existingNew;
  const legacy = await parent.getDirectoryHandle(LEGACY_PROGRAMM_DIR_NAME).catch(() => null);
  if (legacy) return legacy;
  return parent.getDirectoryHandle(PROGRAMM_DIR_NAME, { create: true });
}

/** Liefert das `_intern/`-Handle am Parent-Root (create-on-demand). */
export async function getInternHandle(parent: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  return parent.getDirectoryHandle(INTERN_DIR, { create: true });
}

/** Legt die v1.9-Folder-Struktur unter dem Daten-Share an (idempotent). */
export async function ensureFolderStructure(parent: FileSystemDirectoryHandle): Promise<void> {
  const programm = await parent.getDirectoryHandle(PROGRAMM_DIR_NAME, { create: true });
  for (const sub of PROGRAMM_SUBDIRS) {
    await programm.getDirectoryHandle(sub, { create: true });
  }
  await parent.getDirectoryHandle(BACKUPS_DIR, { create: true });
  const intern = await parent.getDirectoryHandle(INTERN_DIR, { create: true });
  await intern.getDirectoryHandle('feedback', { create: true });
  await ensureReadme(parent);
}

const README_CONTENT = `TeamFlow — Datenspeicher

Dieser Ordner ist der Datenspeicher der TeamFlow-App.

Bitte nichts in diesem Ordner manuell bearbeiten, verschieben oder
löschen. Die App verwaltet den Inhalt selbstständig.

Nutzer starten die App über die Desktop-Verknüpfung, nicht über
diesen Ordner.

Für Fragen: [Kontakt-Info vom Kurator hier eintragen]
`;

export async function ensureReadme(parent: FileSystemDirectoryHandle): Promise<void> {
  const existing = await parent.getFileHandle(README_PATH).catch(() => null);
  if (existing) return;
  const fh = await parent.getFileHandle(README_PATH, { create: true });
  const w = await fh.createWritable();
  await w.write(README_CONTENT);
  await w.close();
}

/**
 * Lightweight-Check: prüft Permission + Existenz von `_intern/` (neue Struktur)
 * ODER `programm-test/admin/` (Legacy vor Migration).
 */
export async function isSmbAvailable(parent: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const perm = await queryPermission(parent);
    if (perm !== 'granted') return false;
    const intern = await parent.getDirectoryHandle(INTERN_DIR).catch(() => null);
    if (intern) return true;
    const legacyProgramm = await parent.getDirectoryHandle(LEGACY_PROGRAMM_DIR_NAME).catch(() => null);
    if (!legacyProgramm) return false;
    await legacyProgramm.getDirectoryHandle('admin').catch(() => null);
    return true;
  } catch {
    return false;
  }
}

/** Optionaler Helper: schreibt eine leere Probe-Datei im _intern/-Ordner. */
export async function writeHeartbeatProbe(parent: FileSystemDirectoryHandle): Promise<void> {
  const intern = await parent.getDirectoryHandle(INTERN_DIR, { create: true });
  const fh = await intern.getFileHandle('heartbeat-probe', { create: true });
  const w = await fh.createWritable();
  await w.write(new Uint8Array(0));
  await w.close();
}

export { HEARTBEAT_PROBE_PATH, INTERN_FEEDBACK_DIR };
