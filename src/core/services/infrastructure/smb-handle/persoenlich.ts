/** Der persoenliche Ordner (Home-Laufwerk des Users). */
import { IDBStore } from '@/core/services/storage/idb-store';
import { SMB_HANDLE_PERSOENLICH, PERSOENLICH_ZAH_DIR } from '../types';
import { readAll, writeAll, pickDirectory, type PickResult } from './kern';

/**
 * Oeffnet den Picker (readwrite) und persistiert den Persoenlich-Handle.
 * Legt die Unterstruktur `ZAH/feedback/outbox/` automatisch an, damit
 * spaetere Outbox-Writes ohne extra Setup-Schritt funktionieren.
 */
export async function pickAndStorePersoenlichHandle(idb: IDBStore): Promise<PickResult> {
  const res = await pickDirectory('readwrite', SMB_HANDLE_PERSOENLICH);
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
 * v4.1: Wurzeln der persoenlichen Ordner (Kurator-Pick fuer das Einsammeln)
 *
 * Bis v4.0 war das EIN Slot. Seit v4.1 liegen die persoenlichen Ordner unter
 * mehreren Wurzeln (`personalFolder.roots`) — je Gruppe ein Slot unter dem
 * Praefix, nach demselben Muster wie die DMS-Sources. Der Alt-Slot bleibt
 * lesbar und erscheint als eigener Eintrag `legacy`.
 *
 * Alle Funktionen nehmen die `rootId` explizit: es gibt keinen „den" Root mehr,
 * und die Signaturaenderung zwingt jede Aufrufstelle zu einer Entscheidung.
 * -------------------------------------------------------------------------- */
