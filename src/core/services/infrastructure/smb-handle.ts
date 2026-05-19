/**
 * SMB-Handle-Manager (Phase 1a + v1.9-Strukturkonsolidierung + v2.0).
 *
 * Persistiert mehrere File System Access API DirectoryHandles:
 *  - Daten-Share: Root-Ordner mit programm/, backups/, _intern/, README.txt
 *  - Persoenlich (v2.0): Home-Laufwerk des Users (rw) fuer profile.json,
 *    einstellungen.json, Feedback-Outbox
 *  - Dokumentenquelle (Phase 2, deprecated seit v1.15): Legacy-Single-Slot
 *  - DMS-Source (v1.15): `dms-source-${id}` pro Source (Kurator-Read-Only)
 *  - User-Folders-Root (v2.0): Wurzel der Home-Laufwerke, einmaliger Kurator-
 *    Pick um Feedback-Outboxen einzusammeln
 *
 * IDB-Layout: Key `smb-handles` → `Record<string, FileSystemDirectoryHandle>`.
 * Legacy-Slot `test-programm` wird beim Laden transparent als Daten-Share gelesen.
 */

import { IDBStore } from '@/core/services/storage/idb-store';
import {
  SMB_HANDLES_IDB_KEY,
  SMB_HANDLE_DATEN_SHARE,
  SMB_HANDLE_DOKUMENTENQUELLE,
  SMB_HANDLE_LEGACY_TEST_PROGRAMM,
  SMB_HANDLE_PERSOENLICH,
  SMB_HANDLE_USER_FOLDERS_ROOT,
  DMS_SOURCE_SLOT_PREFIX,
  dmsSourceSlotKey,
  PROGRAMM_SUBDIRS,
  PROGRAMM_DIR_NAME,
  LEGACY_PROGRAMM_DIR_NAME,
  BACKUPS_DIR,
  INTERN_DIR,
  INTERN_FEEDBACK_DIR,
  HEARTBEAT_PROBE_PATH,
  README_PATH,
  PERSOENLICH_TEAMFLOW_DIR,
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

async function pickDirectory(
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<FileSystemDirectoryHandle | { aborted: true } | { error: string }> {
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

/**
 * Öffnet den Picker und persistiert das Daten-Share-Handle.
 *
 * Mode-Logik (v2.0): Kurator pickt `readwrite` (App schreibt Manifest, Audit-Log,
 * Backups), Nicht-Kurator pickt `read` (Hardening — die App schreibt im
 * Nicht-Kurator-Pfad nicht in den Daten-Share). Default bleibt `readwrite` für
 * Backwards-Kompatibilitaet; explizit `{ mode: 'read' }` setzen wenn die App
 * den Nicht-Kurator-Pfad fahren soll.
 */
export async function pickAndStoreDatenShareHandle(
  idb: IDBStore,
  opts: { mode?: 'read' | 'readwrite' } = {},
): Promise<PickResult> {
  const mode = opts.mode ?? 'readwrite';
  const res = await pickDirectory(mode);
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

/**
 * @deprecated Seit v1.15 nur noch fuer Tests / Migration. Multi-Source-Quellen
 * werden via `pickAndStoreDmsSourceHandle(idb, sourceId)` verwaltet. Aufrufer
 * sollten die DMS-Source-API benutzen; dieser Single-Slot-Picker wird in
 * einem Folge-Patch entfernt.
 *
 * **Read-Only**: Die App liest die DMS-Dokumente nur (Triage liest erste Seite,
 * Bulk-Scan listet die Dateibaum-Struktur). Es wird NIE in dieses Verzeichnis
 * geschrieben. `mode: 'read'` sorgt dafuer, dass der Browser-Dialog
 * "Dateien lesen" anzeigt statt "Dateien bearbeiten".
 */
export async function pickAndStoreDokumentenquelleHandle(idb: IDBStore): Promise<PickResult> {
  const res = await pickDirectory('read');
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

/**
 * @deprecated Seit v1.15. Nur noch von der Migration genutzt, um den Legacy-
 * Slot in eine Default-`dms-source-default`-Slot zu kopieren. Produktive
 * Aufrufer sollen `getDmsSourceHandle(idb, sourceId)` mit der konkreten Source
 * verwenden — die Source-ID liegt am ManifestEntry (`entry.source_id`).
 */
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

/**
 * @deprecated Seit v1.15. Nur noch von der Migration / Cleanup-Routinen
 * benutzt. Aufrufer fuer normale Source-Pflege sollen `clearDmsSourceHandle`
 * mit der konkreten Source-ID verwenden.
 */
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
 * Read-only Permission-Variante fuer den Dokumentenquelle-Handle.
 * Verhindert dass beim Re-Permit der Browser den 'bearbeiten'-Dialog zeigt.
 */
export async function queryReadPermission(handle: FileSystemDirectoryHandle): Promise<PermState> {
  return (handle as FsDirHandle).queryPermission({ mode: 'read' });
}

/** MUSS aus einem User-Gesture-Handler aufgerufen werden. */
export async function refreshReadPermission(handle: FileSystemDirectoryHandle): Promise<PermState> {
  return (handle as FsDirHandle).requestPermission({ mode: 'read' });
}

/* --------------------------------------------------------------------------
 * v1.15: Multi-Source-DMS-Handles
 * -------------------------------------------------------------------------- */

/**
 * Liefert den FileSystemDirectoryHandle einer DMS-Source. `null` wenn keiner
 * verbunden ist. Bei der `default`-Source wird transparent auf den Legacy-
 * `dokumentenquelle`-Slot zurueckgefallen, falls die Migration noch nicht
 * stattgefunden hat.
 */
export async function getDmsSourceHandle(
  idb: IDBStore,
  sourceId: string,
): Promise<FileSystemDirectoryHandle | null> {
  const map = await readAll(idb);
  const direct = map[dmsSourceSlotKey(sourceId)];
  if (direct) return direct;
  if (sourceId === 'default') {
    return map[SMB_HANDLE_DOKUMENTENQUELLE] ?? null;
  }
  return null;
}

/** Persistiert (oder ueberschreibt) den Handle einer DMS-Source. */
export async function setDmsSourceHandle(
  idb: IDBStore,
  sourceId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const map = await readAll(idb);
  map[dmsSourceSlotKey(sourceId)] = handle;
  await writeAll(idb, map);
}

/** Entfernt den Handle einer DMS-Source aus der Map. */
export async function clearDmsSourceHandle(
  idb: IDBStore,
  sourceId: string,
): Promise<void> {
  const map = await readAll(idb);
  delete map[dmsSourceSlotKey(sourceId)];
  // Bei der Default-Source auch den Legacy-Slot mit aufraeumen, damit kein
  // Phantom-Handle uebrig bleibt.
  if (sourceId === 'default') {
    delete map[SMB_HANDLE_DOKUMENTENQUELLE];
  }
  await writeAll(idb, map);
}

/**
 * Oeffnet den Picker (Read-Only) und persistiert den ausgewaehlten Handle
 * unter dem `dms-source-${sourceId}`-Slot.
 */
export async function pickAndStoreDmsSourceHandle(
  idb: IDBStore,
  sourceId: string,
): Promise<PickResult> {
  const res = await pickDirectory('read');
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return {
      ok: false,
      reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error',
      message: res.error,
    };
  }
  await setDmsSourceHandle(idb, sourceId, res);
  return { ok: true, handle: res };
}

/**
 * Migrations-Helper: kopiert den Legacy-`dokumentenquelle`-Slot auf den neuen
 * `dms-source-${sourceId}`-Slot. Wird einmalig in `migrateLegacyDmsSource`
 * aufgerufen. Idempotent — ueberschreibt einen evtl. schon vorhandenen Slot
 * nur dann, wenn der Legacy-Slot tatsaechlich gesetzt ist.
 */
export async function copyDokumentenquelleToDmsSource(
  idb: IDBStore,
  sourceId: string,
): Promise<boolean> {
  const map = await readAll(idb);
  const legacy = map[SMB_HANDLE_DOKUMENTENQUELLE];
  if (!legacy) return false;
  const slot = dmsSourceSlotKey(sourceId);
  if (!map[slot]) {
    map[slot] = legacy;
    await writeAll(idb, map);
  }
  return true;
}

/** Liefert die Source-IDs aller in der Handles-Map registrierten DMS-Sources. */
export async function listDmsSourceSlotIds(idb: IDBStore): Promise<string[]> {
  const map = await readAll(idb);
  return Object.keys(map)
    .filter(k => k.startsWith(DMS_SOURCE_SLOT_PREFIX))
    .map(k => k.slice(DMS_SOURCE_SLOT_PREFIX.length));
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

/* --------------------------------------------------------------------------
 * v2.0: Persoenlicher Ordner (Home-Laufwerk des Users)
 * -------------------------------------------------------------------------- */

/**
 * Oeffnet den Picker (readwrite) und persistiert den Persoenlich-Handle.
 * Legt die Unterstruktur `teamflow/feedback/outbox/` automatisch an, damit
 * spaetere Outbox-Writes ohne extra Setup-Schritt funktionieren.
 */
export async function pickAndStorePersoenlichHandle(idb: IDBStore): Promise<PickResult> {
  const res = await pickDirectory('readwrite');
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return { ok: false, reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error', message: res.error };
  }
  const map = await readAll(idb);
  map[SMB_HANDLE_PERSOENLICH] = res;
  await writeAll(idb, map);
  await ensurePersoenlichFolders(res).catch(() => undefined);
  return { ok: true, handle: res };
}

export async function getPersoenlichHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const map = await readAll(idb);
  return map[SMB_HANDLE_PERSOENLICH] ?? null;
}

export async function clearPersoenlichHandle(idb: IDBStore): Promise<void> {
  const map = await readAll(idb);
  delete map[SMB_HANDLE_PERSOENLICH];
  await writeAll(idb, map);
}

/** Legt `teamflow/` + `teamflow/feedback/` + `teamflow/feedback/outbox/` an (idempotent). */
export async function ensurePersoenlichFolders(parent: FileSystemDirectoryHandle): Promise<void> {
  const tf = await parent.getDirectoryHandle(PERSOENLICH_TEAMFLOW_DIR, { create: true });
  const fb = await tf.getDirectoryHandle('feedback', { create: true });
  await fb.getDirectoryHandle('outbox', { create: true });
}

/* --------------------------------------------------------------------------
 * v2.0: User-Folders-Root (Kurator-Pick fuer Outbox-Einsammeln)
 * -------------------------------------------------------------------------- */

export async function pickAndStoreUserFoldersRootHandle(idb: IDBStore): Promise<PickResult> {
  const res = await pickDirectory('read');
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return { ok: false, reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error', message: res.error };
  }
  const map = await readAll(idb);
  map[SMB_HANDLE_USER_FOLDERS_ROOT] = res;
  await writeAll(idb, map);
  return { ok: true, handle: res };
}

export async function getUserFoldersRootHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const map = await readAll(idb);
  return map[SMB_HANDLE_USER_FOLDERS_ROOT] ?? null;
}

export async function clearUserFoldersRootHandle(idb: IDBStore): Promise<void> {
  const map = await readAll(idb);
  delete map[SMB_HANDLE_USER_FOLDERS_ROOT];
  await writeAll(idb, map);
}

/* --------------------------------------------------------------------------
 * v2.0: refreshAllPermissions — eine User-Gesture-Quelle, alle Handles
 * -------------------------------------------------------------------------- */

export type PermStateOrMissing = 'granted' | 'denied' | 'prompt' | 'missing';

export interface RefreshAllResult {
  datenShare: PermStateOrMissing;
  persoenlich: PermStateOrMissing;
  userFoldersRoot: PermStateOrMissing;
  dmsSources: Record<string, PermStateOrMissing>;
}

/**
 * Fordert Permission fuer alle gespeicherten Handles in einer einzigen User-
 * Gesture-Kette an. Mode-Wahl pro Slot:
 * - daten-share: `read` wenn Nicht-Kurator, sonst `readwrite`
 * - persoenlich: `readwrite`
 * - user-folders-root: `read` (nur Kurator-Anwendungsfall)
 * - dms-source-*: `read`
 *
 * Slots ohne gespeicherten Handle bekommen `'missing'`. Permissions die
 * fehlschlagen werden als `'denied'` zurueckgegeben — der Aufrufer entscheidet
 * was offline-mode ausloest.
 *
 * MUSS aus einem User-Gesture-Handler (Click) aufgerufen werden, damit der
 * Browser die Permission-Dialoge nicht blockt.
 */
export async function refreshAllPermissions(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<RefreshAllResult> {
  const map = await readAll(idb);
  const result: RefreshAllResult = {
    datenShare: 'missing',
    persoenlich: 'missing',
    userFoldersRoot: 'missing',
    dmsSources: {},
  };

  const datenShare = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  if (datenShare) {
    const mode = opts.isKurator ? 'readwrite' : 'read';
    try {
      result.datenShare = await (datenShare as FsDirHandle).requestPermission({ mode });
    } catch {
      result.datenShare = 'denied';
    }
  }

  const persoenlich = map[SMB_HANDLE_PERSOENLICH];
  if (persoenlich) {
    try {
      result.persoenlich = await (persoenlich as FsDirHandle).requestPermission({ mode: 'readwrite' });
    } catch {
      result.persoenlich = 'denied';
    }
  }

  if (opts.isKurator) {
    const userFolders = map[SMB_HANDLE_USER_FOLDERS_ROOT];
    if (userFolders) {
      try {
        result.userFoldersRoot = await (userFolders as FsDirHandle).requestPermission({ mode: 'read' });
      } catch {
        result.userFoldersRoot = 'denied';
      }
    }

    for (const key of Object.keys(map)) {
      if (!key.startsWith(DMS_SOURCE_SLOT_PREFIX)) continue;
      const sourceId = key.slice(DMS_SOURCE_SLOT_PREFIX.length);
      try {
        result.dmsSources[sourceId] = await (map[key] as FsDirHandle).requestPermission({ mode: 'read' });
      } catch {
        result.dmsSources[sourceId] = 'denied';
      }
    }
  }

  return result;
}

/**
 * v2.0 Migration-Check: Wenn ein Nicht-Kurator einen Daten-Share-Handle mit
 * `readwrite`-Mode in IDB hat, sollte er beim Start einen Re-Pick mit
 * `read`-Mode bekommen. Liefert `true` wenn ein Downgrade noetig ist.
 */
export async function needsDatenShareDowngrade(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<boolean> {
  if (opts.isKurator) return false;
  const map = await readAll(idb);
  const handle = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  if (!handle) return false;
  try {
    const rw = await (handle as FsDirHandle).queryPermission({ mode: 'readwrite' });
    return rw === 'granted';
  } catch {
    return false;
  }
}
