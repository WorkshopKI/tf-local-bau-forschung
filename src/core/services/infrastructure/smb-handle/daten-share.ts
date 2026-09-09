/** Der Daten-Share-Slot: waehlen, lesen, loeschen, Berechtigung pruefen. */
import { IDBStore } from '@/core/services/storage/idb-store';
import { SMB_HANDLE_DATEN_SHARE, SMB_HANDLE_DOKUMENTENQUELLE, SMB_HANDLE_LEGACY_TEST_PROGRAMM } from '../types';
import { readAll, writeAll, pickDirectory, type PermState, type FsDirHandle } from './kern';

/**
 * Öffnet den Picker und persistiert das Daten-Share-Handle.
 *
 * Mode-Logik (v2.0): Kurator pickt `readwrite` (App schreibt Manifest, Audit-Log,
 * Backups), Nicht-Kurator pickt `read` (Hardening — die App schreibt im
 * Nicht-Kurator-Pfad nicht in den Daten-Share). Default bleibt `readwrite` für
 * Backwards-Kompatibilitaet; explizit `{ mode: 'read' }` setzen wenn die App
 * den Nicht-Kurator-Pfad fahren soll.
 *
 * v4.0: Im Erfolgsfall wird zusätzlich das ZUVOR gespeicherte Handle
 * zurückgegeben (`vorher`). Der Picker persistiert sein Ergebnis nämlich sofort
 * — die nachgelagerten Prüfungen in `connectDataShare` (Ordnername, Struktur)
 * laufen erst danach. Ohne diesen Rückgabewert hätte ein Fehlgriff beim
 * Umzugs-Re-Pick den alten, funktionierenden Handle bereits überschrieben.
 * `vorher` ist `null`, wenn es keinen gab.
 */
export type PickDatenShareResult =
  | { ok: true; handle: FileSystemDirectoryHandle; vorher: FileSystemDirectoryHandle | null }
  | { ok: false; reason: 'unsupported' | 'aborted' | 'error'; message?: string };

export async function pickAndStoreDatenShareHandle(
  idb: IDBStore,
  opts: { mode?: 'read' | 'readwrite' } = {},
): Promise<PickDatenShareResult> {
  const mode = opts.mode ?? 'readwrite';
  const res = await pickDirectory(mode, SMB_HANDLE_DATEN_SHARE);
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return { ok: false, reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error', message: res.error };
  }
  const map = await readAll(idb);
  const vorher = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM] ?? null;
  map[SMB_HANDLE_DATEN_SHARE] = res;
  // Legacy-Slot aufräumen falls noch gesetzt.
  delete map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  await writeAll(idb, map);
  return { ok: true, handle: res, vorher };
}

/**
 * Setzt das Daten-Share-Handle direkt (ohne Picker) — bzw. entfernt es bei
 * `null`. Einziger Anwendungsfall ist der Rollback in `connectDataShare`, wenn
 * der frisch gepickte Ordner die Prüfungen NICHT besteht: der Anwender muss im
 * alten, funktionierenden Zustand landen, nicht in einem halb gewechselten.
 */
export async function setDatenShareHandle(
  idb: IDBStore,
  handle: FileSystemDirectoryHandle | null,
): Promise<void> {
  const map = await readAll(idb);
  if (handle) map[SMB_HANDLE_DATEN_SHARE] = handle;
  else delete map[SMB_HANDLE_DATEN_SHARE];
  await writeAll(idb, map);
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
