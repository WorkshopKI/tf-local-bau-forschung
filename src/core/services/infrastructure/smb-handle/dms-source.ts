/** DMS-Quellen (v1.15): ein Slot je Quelle, Kurator-Read-Only. */
import { IDBStore } from '@/core/services/storage/idb-store';
import { SMB_HANDLE_DOKUMENTENQUELLE, DMS_SOURCE_SLOT_PREFIX, dmsSourceSlotKey } from '../types';
import { readAll, writeAll, pickDirectory, type PickResult } from './kern';

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
  const res = await pickDirectory('read', dmsSourceSlotKey(sourceId));
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
