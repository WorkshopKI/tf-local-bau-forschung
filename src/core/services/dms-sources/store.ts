/**
 * IDB-CRUD fuer den `dms_sources`-Store (v1.15+).
 *
 * Store-Struktur siehe types.ts. Der zugehoerige FileSystemDirectoryHandle
 * lebt unter `dms-source-${id}` in der `smb-handles`-Map (siehe
 * smb-handle.ts) — dieser Store haelt nur Metadaten.
 */

import type { IDBStore } from '../storage/idb-store';
import { DMS_SOURCES_STORE } from '../storage/idb-store';
import { uuid } from '../id-generator';
import type {
  DmsSourceEntry,
  DmsSourceHandleStatus,
  DmsSourceIndexStats,
} from './types';

export async function listDmsSources(idb: IDBStore): Promise<DmsSourceEntry[]> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DMS_SOURCES_STORE, 'readonly');
    const req = tx.objectStore(DMS_SOURCES_STORE).getAll();
    req.onsuccess = () => resolve((req.result as DmsSourceEntry[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function getDmsSource(idb: IDBStore, id: string): Promise<DmsSourceEntry | null> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DMS_SOURCES_STORE, 'readonly');
    const req = tx.objectStore(DMS_SOURCES_STORE).get(id);
    req.onsuccess = () => resolve((req.result as DmsSourceEntry | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listActiveDmsSources(idb: IDBStore): Promise<DmsSourceEntry[]> {
  const all = await listDmsSources(idb);
  return all.filter(s => s.is_active === true);
}

export interface DmsSourceCreateInput {
  id?: string;
  label: string;
  sub_roots?: string[];
  is_active?: boolean;
  created_by?: string;
}

export async function createDmsSource(
  idb: IDBStore,
  input: DmsSourceCreateInput,
): Promise<DmsSourceEntry> {
  const now = new Date().toISOString();
  const entry: DmsSourceEntry = {
    id: input.id ?? uuid(),
    label: input.label,
    sub_roots: input.sub_roots ?? [],
    is_active: input.is_active ?? false,
    created_at: now,
    created_by: input.created_by ?? '',
    updated_at: now,
  };
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DMS_SOURCES_STORE, 'readwrite');
    tx.objectStore(DMS_SOURCES_STORE).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export interface DmsSourceUpdateInput {
  label?: string;
  sub_roots?: string[];
  is_active?: boolean;
  last_indexed_at?: string;
  last_index_stats?: DmsSourceIndexStats;
  handle_status?: DmsSourceHandleStatus;
}

export async function updateDmsSource(
  idb: IDBStore,
  id: string,
  patch: DmsSourceUpdateInput,
): Promise<DmsSourceEntry> {
  const existing = await getDmsSource(idb, id);
  if (!existing) {
    throw new Error(`DMS-Source ${id} nicht gefunden`);
  }
  const merged: DmsSourceEntry = {
    ...existing,
    ...patch,
    updated_at: new Date().toISOString(),
  };
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DMS_SOURCES_STORE, 'readwrite');
    tx.objectStore(DMS_SOURCES_STORE).put(merged);
    tx.oncomplete = () => resolve(merged);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteDmsSource(idb: IDBStore, id: string): Promise<void> {
  const db = idb.getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DMS_SOURCES_STORE, 'readwrite');
    tx.objectStore(DMS_SOURCES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
