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
  PERSOENLICH_ZAH_DIR,
  CSV_SOURCE_HANDLES_IDB_KEY,
  CSV_SOURCE_DIR_HANDLE_IDB_KEY,
} from './types';
import { canWriteDatenShare, isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';

type PermState = 'granted' | 'denied' | 'prompt';

export interface FsDirHandle extends FileSystemDirectoryHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

/** Wie FsDirHandle, aber fuer Datei-Handles (z.B. CSV-Quelldateien). */
export interface FsFileHandle extends FileSystemFileHandle {
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

/**
 * True, wenn der Daten-Share-Handle existiert UND aktuell read-`granted` ist
 * (silent `queryPermission`, kein Gesture). Genutzt vom Auslastungs-Store, um
 * einen pre-grant/offline-Load (Permission noch `'prompt'`) NICHT als
 * endgueltig „geladen" festzuschreiben — sonst bliebe die Reload-Guard scharf
 * und echte `auslastung.json`-Daten wuerden nach dem Grant nie nachgeladen
 * (v2.19.2-Bug: 0 MAs / fehlende Centroids nach Restart auf der pl).
 */
export async function isDatenShareReadable(idb: IDBStore): Promise<boolean> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return false;
  try {
    return (await queryReadPermission(handle)) === 'granted';
  } catch {
    return false;
  }
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
 * Legt die Unterstruktur `ZAH/feedback/outbox/` automatisch an, damit
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

/** Legt `ZAH/` + `ZAH/feedback/` + `ZAH/feedback/outbox/` an (idempotent). */
export async function ensurePersoenlichFolders(parent: FileSystemDirectoryHandle): Promise<void> {
  const tf = await parent.getDirectoryHandle(PERSOENLICH_ZAH_DIR, { create: true });
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

/**
 * Non-invasiver Permission-Status des User-Folders-Root-Handles (`queryPermission`
 * read, KEIN Gesture). Für Auto-Load-/Timer-Pfade, die das Verzeichnis sonst
 * blind iterieren würden (→ `NotAllowedError`, wenn die Permission unter
 * `file://` nach Neustart verfallen ist). `'missing'` wenn kein Handle in IDB.
 */
export async function queryUserFoldersRootPermission(
  idb: IDBStore,
): Promise<PermStateOrMissing> {
  const map = await readAll(idb);
  const handle = map[SMB_HANDLE_USER_FOLDERS_ROOT];
  if (!handle) return 'missing';
  try {
    return await (handle as FsDirHandle).queryPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

/**
 * Gibt das User-Folders-Root-Handle (read) frei. MUSS aus einem User-Gesture-
 * Handler laufen → ein Prompt. Spiegel von `refreshCsvSourceDirPermission`:
 * no-op't, wenn die Permission schon `granted` ist (kein Doppel-Prompt).
 * `'missing'` wenn kein Handle in IDB.
 */
export async function refreshUserFoldersRootPermission(
  idb: IDBStore,
): Promise<PermStateOrMissing> {
  const map = await readAll(idb);
  const handle = map[SMB_HANDLE_USER_FOLDERS_ROOT];
  if (!handle) return 'missing';
  try {
    const h = handle as FsDirHandle;
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return 'granted';
    return await h.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
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
    // Schreibrecht: Kurator ODER Build erlaubt es generell (pl-Variante).
    // userFoldersRoot/DMS unten bleiben bewusst kurator-only.
    const mode = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
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

  // v2.19.1: CSV-Quellen-Datei-Handles im selben User-Gesture re-granten (pl +
  // kurator + dev). FSAPI-Datei-Berechtigungen gehen unter file:// pro Browser-
  // Session verloren — genau wie der Daten-Share oben; ohne das fragt der
  // Auto-Refresh-Banner nach jedem Neustart erneut nach Verknüpfung. Die
  // CSV-Handles liegen in einem eigenen IDB-Key (nicht im smb-handles-Map),
  // daher separat. Nur Handles mit verlorener Permission ('prompt') anfragen;
  // best-effort — denied/Fehler ignorieren (Banner faellt dann auf den
  // Re-Pick-Picker zurueck).
  if (isKuratorMenusEnabled() || isCsvAutoRefreshEnabled()) {
    // v2.27: bevorzugt das EINE Ordner-Handle — ein Prompt, Permission kaskadiert
    // auf alle CSVs. Existiert es, ist die Legacy-Per-Datei-Schleife überflüssig
    // (und würde nur unnötig Gesture-Budget verbrauchen). Beachte: aus dem
    // StartupScreen-Gesture verbraucht schon der Daten-Share oben die Activation
    // → dieser Re-Grant schlägt dort still fehl; er gelingt im sauberen pl-
    // AppPasswordGate-Gesture (siehe refreshCsvSourceDirPermission).
    const dirHandle = await idb.get<FileSystemDirectoryHandle>(CSV_SOURCE_DIR_HANDLE_IDB_KEY);
    if (dirHandle) {
      try {
        const h = dirHandle as FsDirHandle;
        if ((await h.queryPermission({ mode: 'read' })) !== 'granted') {
          await h.requestPermission({ mode: 'read' });
        }
      } catch {
        /* best-effort — denied/Fehler ignorieren */
      }
    } else {
      const csvHandles = await idb.get<Record<string, FileSystemFileHandle>>(CSV_SOURCE_HANDLES_IDB_KEY);
      if (csvHandles) {
        for (const handle of Object.values(csvHandles)) {
          const h = handle as FsFileHandle;
          try {
            if ((await h.queryPermission({ mode: 'read' })) !== 'granted') {
              await h.requestPermission({ mode: 'read' });
            }
          } catch {
            /* best-effort — denied/Fehler ignorieren */
          }
        }
      }
    }
  }

  return result;
}

/**
 * v2.27: Gibt NUR das CSV-Quellen-Ordner-Handle frei (nicht Daten-Share/
 * persoenlich). Gedacht für einen "sauberen" zweiten User-Gesture (pl-
 * AppPasswordGate), in dem der Daten-Share bereits aus dem vorherigen
 * StartupScreen-Gesture granted ist — so bekommt der Ordner-Prompt den
 * einzigen Prompt-Slot des Gestures (das one-prompt-per-gesture-Limit unter
 * `file://`). Ein Re-Grant des Ordner-Handles deckt via Permission-Kaskade
 * alle enthaltenen CSV-Dateien ab.
 *
 * MUSS aus einem User-Gesture-Handler aufgerufen werden. Best-effort:
 * `'missing'` wenn kein Ordner verknüpft ist, sonst der resultierende
 * Permission-State (`'denied'` bei Fehler).
 */
export async function refreshCsvSourceDirPermission(
  idb: IDBStore,
): Promise<PermState | 'missing'> {
  const handle = await idb.get<FileSystemDirectoryHandle>(CSV_SOURCE_DIR_HANDLE_IDB_KEY);
  if (!handle) return 'missing';
  try {
    const h = handle as FsDirHandle;
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return 'granted';
    return await h.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

/* --------------------------------------------------------------------------
 * v2.55: Guided-Grant-Stepper — eine Freigabe pro User-Gesture (file://)
 *
 * Unter file:// zeigt Chrome pro User-Gesture nur EINEN Permission-Prompt;
 * `refreshAllPermissions` fragt mehrere Handles sequenziell im selben Klick an
 * → nur der erste promptet, der Rest verhungert still (siehe
 * docs/architecture/recurring-bug-classes.md §2). Der StartupScreen-Stepper
 * gibt stattdessen pro Klick GENAU EIN Handle frei. Diese Helfer liefern die
 * Liste der noch ausstehenden Grants (non-invasiv) und führen den Einzel-Grant
 * aus.
 * -------------------------------------------------------------------------- */

export type PendingGrantSlot = 'daten-share' | 'persoenlich' | 'csv-source';

/**
 * Ein noch ausstehender Permission-Grant: Handle liegt in IDB, ist aber für
 * seinen benötigten Mode noch nicht `granted`. Der Stepper rendert pro Eintrag
 * genau einen Klick-Schritt.
 */
export interface PendingGrant {
  slot: PendingGrantSlot;
  handle: FsDirHandle;
  mode: 'read' | 'readwrite';
  /** Menschlich lesbares Label für den Stepper-Button (z.B. „Datenordner"). */
  label: string;
}

async function isHandleGranted(
  h: FileSystemDirectoryHandle | undefined,
  mode: 'read' | 'readwrite',
): Promise<boolean> {
  if (!h) return false;
  try {
    return (await (h as FsDirHandle).queryPermission({ mode })) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Non-invasiver Scan (nur `queryPermission`, kein Gesture): liefert die Handles,
 * die in IDB liegen, aber für ihren benötigten Mode noch NICHT `granted` sind —
 * als geordnete Klick-Schritte für den Guided-Stepper (Daten-Share → persönlich
 * → CSV-Quelle).
 *
 * Mode-/Gate-Logik identisch zu `refreshAllPermissions` (Pitfall #25: Mode nur
 * über `canWriteDatenShare`). Kurator-only-Slots (User-Folders-Root, DMS) sind
 * bewusst NICHT enthalten — die laufen weiter über die Post-Login-Eskalation im
 * AppPasswordGate (`isKurator` ist beim StartupScreen-Pre-Login false).
 */
export async function listPendingGrants(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<PendingGrant[]> {
  const map = await readAll(idb);
  const pending: PendingGrant[] = [];

  const datenShare = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  const dsMode: 'read' | 'readwrite' = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
  if (datenShare && !(await isHandleGranted(datenShare, dsMode))) {
    pending.push({ slot: 'daten-share', handle: datenShare as FsDirHandle, mode: dsMode, label: 'Datenordner' });
  }

  const persoenlich = map[SMB_HANDLE_PERSOENLICH];
  if (persoenlich && !(await isHandleGranted(persoenlich, 'readwrite'))) {
    pending.push({ slot: 'persoenlich', handle: persoenlich as FsDirHandle, mode: 'readwrite', label: 'Persönlicher Ordner' });
  }

  if (isKuratorMenusEnabled() || isCsvAutoRefreshEnabled()) {
    const csvDir = await idb.get<FileSystemDirectoryHandle>(CSV_SOURCE_DIR_HANDLE_IDB_KEY);
    if (csvDir && !(await isHandleGranted(csvDir, 'read'))) {
      pending.push({ slot: 'csv-source', handle: csvDir as FsDirHandle, mode: 'read', label: 'CSV-Quelle' });
    }
  }

  return pending;
}

/**
 * Gibt GENAU EIN Pending-Handle frei. MUSS aus einem User-Gesture-Handler
 * laufen → genau ein Browser-Prompt. Best-effort: `'denied'` bei Fehler.
 */
export async function grantPending(grant: PendingGrant): Promise<PermState> {
  try {
    return await grant.handle.requestPermission({ mode: grant.mode });
  } catch {
    return 'denied';
  }
}

/**
 * Non-invasiver Spiegel von `refreshAllPermissions`: liest pro Slot nur
 * `queryPermission` (kein User-Gesture) und liefert denselben
 * `RefreshAllResult`. Gedacht, um nach dem Guided-Stepper den ConnectionState
 * (`applyRefreshResult`) zu aktualisieren, ohne erneut zu prompten.
 */
export async function queryAllPermissions(
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
    const mode = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
    try {
      result.datenShare = await (datenShare as FsDirHandle).queryPermission({ mode });
    } catch {
      result.datenShare = 'denied';
    }
  }

  const persoenlich = map[SMB_HANDLE_PERSOENLICH];
  if (persoenlich) {
    try {
      result.persoenlich = await (persoenlich as FsDirHandle).queryPermission({ mode: 'readwrite' });
    } catch {
      result.persoenlich = 'denied';
    }
  }

  if (opts.isKurator) {
    const userFolders = map[SMB_HANDLE_USER_FOLDERS_ROOT];
    if (userFolders) {
      try {
        result.userFoldersRoot = await (userFolders as FsDirHandle).queryPermission({ mode: 'read' });
      } catch {
        result.userFoldersRoot = 'denied';
      }
    }

    for (const key of Object.keys(map)) {
      if (!key.startsWith(DMS_SOURCE_SLOT_PREFIX)) continue;
      const sourceId = key.slice(DMS_SOURCE_SLOT_PREFIX.length);
      try {
        result.dmsSources[sourceId] = await (map[key] as FsDirHandle).queryPermission({ mode: 'read' });
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
  // Kein Downgrade fuer Rollen, die schreiben duerfen (Kurator ODER Build mit
  // datenShareSchreibrecht, z.B. pl) — die sollen readwrite behalten.
  if (canWriteDatenShare(opts.isKurator)) return false;
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
